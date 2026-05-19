-- Migration: Add Authorization headers to trigger_retry_order trigger function and process-retries-job cron schedule.
-- Redefine trigger function to fetch decrypted service role token and attach it as Bearer token.

CREATE OR REPLACE FUNCTION trigger_retry_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_enabled BOOLEAN;
  v_max_retries INTEGER := 3;
  v_service_role TEXT;
BEGIN
  -- Fetch API access status
  SELECT api_access_enabled INTO v_api_enabled FROM profiles WHERE user_id = NEW.agent_id;
  
  IF v_api_enabled THEN
    v_max_retries := 50;
  END IF;

  -- Fetch decrypted service role token dynamically from vault
  SELECT decrypted_secret INTO v_service_role FROM vault.decrypted_secrets WHERE name = 'supabase_service_role' LIMIT 1;

  -- Fire when the order needs fulfillment or a retry is still allowed
  IF NEW.status = 'paid'
     OR (NEW.status = 'fulfillment_failed' AND COALESCE(NEW.retry_count, 0) < v_max_retries)
  THEN
    PERFORM net.http_post(
      url     := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/process-retries',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_role, '')
      )::jsonb,
      body    := '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Unschedule old cron job if exists
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'process-retries-job';

-- Schedule the process-retries job to run every minute with decrypted service role token
SELECT cron.schedule(
  'process-retries-job',
  '* * * * *',
  $$
  SELECT net.http_post(
      url:='https://lsocdjpflecduumopijn.supabase.co/functions/v1/process-retries',
      headers:=json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body:='{}'::jsonb
  );
  $$
);
