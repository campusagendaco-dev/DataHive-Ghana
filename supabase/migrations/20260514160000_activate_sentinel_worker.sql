-- Activate Sentinel AI Worker
-- Schedules the Sentinel Analytic Core to run every minute for 24/7 autonomous operation
-- NOTE: Service role key is stored in vault.secrets (name = 'supabase_service_role')

-- 1. Sentinel Analytic Core - EVERY MINUTE
-- This turns the Sentinel into an "Always Active" worker
SELECT cron.schedule(
  'sentinel-analytic-core',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/sentinel-ai',
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

-- 2. Sentinel Evolution Loop - EVERY 15 MINUTES
-- Allows the bot to reflect on its performance and upgrade its strategies
SELECT cron.schedule(
  'sentinel-evolution-loop',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/sentinel-evolve',
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
