-- Schedule the process-retries job to run every minute
-- The function itself handles the "wait 2 mins" and "max 4 times" logic
SELECT cron.schedule(
  'process-retries-job',
  '* * * * *',
  $$
  SELECT net.http_post(
      url:='https://lsocdjpflecduumopijn.supabase.co/functions/v1/process-retries',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
  );
  $$
);
