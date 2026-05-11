-- 1. Create the centralized user notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- Can be 'info', 'success', 'warning', 'error'
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Secure the data with Row Level Security
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications" 
  ON public.user_notifications
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;
CREATE POLICY "Users can update own notifications" 
  ON public.user_notifications
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

-- 3. Enable Native Realtime for this table
-- Ensure it is part of the default publication robustly
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;

-- 4. OPTIONAL: Feed systemic events directly into user_notifications from our existing triggers
-- Overwrite the low balance trigger we just created to ALSO push to in-app notifications.
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
  -- Reset the flag if wallet is refilled above threshold, enabling trigger to fire next time it drops.
  IF NEW.api_balance >= 100.00 AND COALESCE(OLD.api_balance, 0) < 100.00 THEN
     NEW.api_low_balance_alert_sent := false;
  END IF;

  -- Detect if balance crossed UNDER 100.00 and hasn't generated an alert yet
  IF NEW.api_balance < 100.00 AND COALESCE(OLD.api_balance, 9999) >= 100.00 
     AND COALESCE(NEW.api_low_balance_alert_sent, false) = false THEN
     
     -- Build standardized notification text
     v_message := '⚠️ Low Balance Alert: Your API Wallet balance is currently GHS ' || ROUND(NEW.api_balance, 2) || '. Please top up soon to avoid service interruption.';

     -- [NEW] AUTOMATIC IN-APP NOTIFICATION INSERT!
     INSERT INTO public.user_notifications (user_id, title, message, type, link)
     VALUES (NEW.agent_id, 'Low API Balance', v_message, 'warning', '/dashboard/api');

     -- [EXISTING] Identify recipient phone number
     SELECT phone INTO v_phone FROM public.profiles WHERE user_id = NEW.agent_id;
     v_normalized_phone := public.normalize_phone_sql(v_phone);

     -- Pull configured SMS Credentials
     SELECT txtconnect_api_key, txtconnect_sender_id 
     INTO v_sms_api_key, v_sms_sender_id 
     FROM public.system_settings 
     WHERE id = 1;

     -- Dispatch SMS via pg_net
     IF v_normalized_phone IS NOT NULL AND v_sms_api_key IS NOT NULL AND v_sms_api_key != '' THEN
        v_payload := jsonb_build_object(
          'to', v_normalized_phone,
          'from', COALESCE(v_sms_sender_id, 'SwiftDataGh'),
          'sms', v_message,
          'unicode', '0'
        );

        PERFORM net.http_post(
          url     := 'https://api.txtconnect.net/dev/api/sms/send',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_sms_api_key),
          body    := v_payload
        );
     END IF;

     -- Mark alert tracking column
     NEW.api_low_balance_alert_sent := true;
  END IF;

  RETURN NEW;
END;
$$;
