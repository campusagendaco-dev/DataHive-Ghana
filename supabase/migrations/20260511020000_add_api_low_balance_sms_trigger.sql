-- 1. Add status tracking column to prevent notification flooding
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS api_low_balance_alert_sent BOOLEAN DEFAULT false;

-- 2. Helper to normalize phone numbers inside trigger context (similar to JS implementation)
CREATE OR REPLACE FUNCTION public.normalize_phone_sql(p_phone TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN NULL;
  END IF;
  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF LENGTH(v_digits) >= 12 AND LEFT(v_digits, 3) = '233' THEN
    RETURN v_digits;
  ELSIF LENGTH(v_digits) >= 10 AND LEFT(v_digits, 1) = '0' THEN
    RETURN '233' || SUBSTRING(v_digits FROM 2);
  ELSIF LENGTH(v_digits) >= 10 THEN
    RETURN v_digits;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- 3. The Trigger Function that detects balance cross & fires async SMS request
CREATE OR REPLACE FUNCTION public.handle_api_wallet_balance_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_phone TEXT;
  v_sms_api_key TEXT;
  v_sms_sender_id TEXT;
  v_message TEXT;
  v_payload JSONB;
  v_normalized_phone TEXT;
BEGIN
  -- A. Reset the flag if wallet is refilled above threshold, enabling trigger to fire next time it drops.
  IF NEW.api_balance >= 100.00 AND COALESCE(OLD.api_balance, 0) < 100.00 THEN
     NEW.api_low_balance_alert_sent := false;
  END IF;

  -- B. Detect if balance crossed UNDER 100.00 and hasn't generated an alert yet
  IF NEW.api_balance < 100.00 AND COALESCE(OLD.api_balance, 9999) >= 100.00 
     AND COALESCE(NEW.api_low_balance_alert_sent, false) = false THEN
     
     -- 1. Identify recipient phone number
     SELECT phone INTO v_phone FROM public.profiles WHERE user_id = NEW.agent_id;
     v_normalized_phone := public.normalize_phone_sql(v_phone);

     -- 2. Pull configured SMS Credentials directly from settings
     SELECT txtconnect_api_key, txtconnect_sender_id 
     INTO v_sms_api_key, v_sms_sender_id 
     FROM public.system_settings 
     WHERE id = 1;

     -- 3. Proceed only if requirements met
     IF v_normalized_phone IS NOT NULL AND v_sms_api_key IS NOT NULL AND v_sms_api_key != '' THEN
        v_message := '⚠️ SwiftData Alert: Your API Wallet dropped below GHS 100. Current Balance: GHS ' || ROUND(NEW.api_balance, 2) || '. Please top-up soon to prevent service disruption.';
        
        v_payload := jsonb_build_object(
          'to', v_normalized_phone,
          'from', COALESCE(v_sms_sender_id, 'SwiftDataGh'),
          'sms', v_message,
          'unicode', '0'
        );

        -- 4. Dispatch direct, asynchronous HTTP Request via pg_net Extension
        PERFORM net.http_post(
          url     := 'https://api.txtconnect.net/dev/api/sms/send',
          headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer ' || v_sms_api_key
          ),
          body    := v_payload
        );

        -- 5. Mark generated alert so it does not spam client on every single next transaction
        NEW.api_low_balance_alert_sent := true;
     END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger monitoring ONLY when API Balance is touched
DROP TRIGGER IF EXISTS trg_api_low_balance_alert ON public.wallets;
CREATE TRIGGER trg_api_low_balance_alert
  BEFORE UPDATE OF api_balance
  ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_api_wallet_balance_trigger();
