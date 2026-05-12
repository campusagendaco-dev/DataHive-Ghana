-- ============================================================
-- RESCHEDULE CRON JOBS with hardcoded URL + service role key
-- (Supabase managed DB does not allow custom app.* settings)
-- ============================================================

-- Remove old schedules (they used current_setting which doesn't work)
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
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-auto-retry',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3OTc0MywiZXhwIjoyMDkxMjU1NzQzfQ.1QNTQHip6aZGlHn8A87S2VVYhu4yQ_BG58C98424MH4"}'::jsonb,
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
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-error-alert',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3OTc0MywiZXhwIjoyMDkxMjU1NzQzfQ.1QNTQHip6aZGlHn8A87S2VVYhu4yQ_BG58C98424MH4"}'::jsonb,
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
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-balance-check',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3OTc0MywiZXhwIjoyMDkxMjU1NzQzfQ.1QNTQHip6aZGlHn8A87S2VVYhu4yQ_BG58C98424MH4"}'::jsonb,
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
      url := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-daily-report',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3OTc0MywiZXhwIjoyMDkxMjU1NzQzfQ.1QNTQHip6aZGlHn8A87S2VVYhu4yQ_BG58C98424MH4"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
