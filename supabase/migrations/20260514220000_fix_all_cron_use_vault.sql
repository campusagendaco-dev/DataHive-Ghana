-- ================================================================
-- SECURITY PATCH: Update all remaining cron jobs to use vault
-- Fixes cron-auto-retry, cron-error-alert, cron-balance-check,
-- cron-daily-report — all had hardcoded service role JWT
-- ================================================================

-- Unschedule old jobs
SELECT cron.unschedule(jobname) FROM cron.job
WHERE jobname IN (
  'cron-auto-retry',
  'cron-error-alert',
  'cron-balance-check',
  'cron-daily-report'
);

-- Reschedule using vault
SELECT cron.schedule(
  'cron-auto-retry',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-auto-retry',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'cron-error-alert',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-error-alert',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'cron-balance-check',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-balance-check',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'cron-daily-report',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-daily-report',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body := '{}'::jsonb
    );
  $$
);
