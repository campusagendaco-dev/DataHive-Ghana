-- ============================================================
-- SCHEDULE CRON JOBS via pg_cron
-- ============================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ── Remove old schedules if they exist (idempotent) ────────────────────────
SELECT cron.unschedule(jobname) FROM cron.job
WHERE jobname IN (
  'cron-auto-retry',
  'cron-error-alert',
  'cron-balance-check',
  'cron-daily-report'
);

-- ── Auto-retry stuck orders — every 5 minutes ──────────────────────────────
SELECT cron.schedule(
  'cron-auto-retry',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cron-auto-retry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── Error spike alert — every 10 minutes ───────────────────────────────────
SELECT cron.schedule(
  'cron-error-alert',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cron-error-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── Provider balance check — every 15 minutes ──────────────────────────────
SELECT cron.schedule(
  'cron-balance-check',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cron-balance-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── Daily P&L report — every day at 07:00 UTC ──────────────────────────────
SELECT cron.schedule(
  'cron-daily-report',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cron-daily-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
