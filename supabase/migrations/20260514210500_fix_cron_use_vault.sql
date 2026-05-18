-- ================================================================
-- SECURITY PATCH: Remove hardcoded service role JWT from cron jobs
-- Replace with vault-backed secret reference
-- Run AFTER rotating your Supabase service role key in the dashboard
-- ================================================================

-- ── Step 1: Store new service role key in vault ──────────────────
-- IMPORTANT: Replace PASTE_YOUR_NEW_SERVICE_ROLE_KEY_HERE with the
-- new key from Supabase Dashboard → Settings → API → service_role
-- Run this once manually in the SQL editor, not via migration:
--
--   SELECT vault.create_secret(
--     'PASTE_YOUR_NEW_SERVICE_ROLE_KEY_HERE',
--     'supabase_service_role',
--     'Service role key for pg_cron scheduled edge functions'
--   );
--
-- Or update if it already exists:
--   UPDATE vault.secrets
--   SET secret = 'PASTE_YOUR_NEW_SERVICE_ROLE_KEY_HERE'
--   WHERE name = 'supabase_service_role';


-- ── Step 2: Unschedule old cron jobs (had hardcoded JWT) ─────────
SELECT cron.unschedule('sentinel-analytic-core');
SELECT cron.unschedule('sentinel-evolution-loop');


-- ── Step 3: Reschedule using vault-backed secret ─────────────────
SELECT cron.schedule(
  'sentinel-analytic-core',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/sentinel-ai',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'sentinel-evolution-loop',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/sentinel-evolve',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role' LIMIT 1
        )
      )::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
