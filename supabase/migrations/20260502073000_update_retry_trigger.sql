-- Update the trigger to support extended retries for API users
CREATE OR REPLACE FUNCTION trigger_retry_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_enabled BOOLEAN;
  v_max_retries INTEGER := 3;
BEGIN
  -- Fetch API access status
  SELECT api_access_enabled INTO v_api_enabled FROM profiles WHERE user_id = NEW.agent_id;
  
  IF v_api_enabled THEN
    v_max_retries := 50;
  END IF;

  -- Fire when the order needs fulfillment or a retry is still allowed
  IF NEW.status = 'paid'
     OR (NEW.status = 'fulfillment_failed' AND COALESCE(NEW.retry_count, 0) < v_max_retries)
  THEN
    PERFORM net.http_post(
      url     := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/process-retries',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;
