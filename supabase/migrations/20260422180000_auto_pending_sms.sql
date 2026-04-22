ALTER TABLE system_settings ADD COLUMN auto_pending_sms_enabled BOOLEAN DEFAULT false;
ALTER TABLE system_settings ADD COLUMN auto_pending_sms_message TEXT DEFAULT 'Your SwiftData transaction is pending. Please try again or contact support.';
ALTER TABLE orders ADD COLUMN sms_reminder_sent BOOLEAN DEFAULT false;

-- Schedule the cron job using pg_cron to hit the Edge Function every 30 minutes
SELECT cron.schedule(
  'auto-pending-sms-job',
  '*/30 * * * *',
  
  SELECT net.http_post(
      url:='https://lsocdjpflecduumopijn.supabase.co/functions/v1/cron-pending-sms',
      headers:='{"Content-Type": "application/json"}'::jsonb
  );
  
);

