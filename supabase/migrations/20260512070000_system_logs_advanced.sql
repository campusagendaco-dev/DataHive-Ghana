-- Advanced system_logs features
-- FTS, provider health view, auto-retry cron, error spike detection

-- 1. Full-text search index on message
CREATE INDEX IF NOT EXISTS idx_system_logs_message_fts
  ON public.system_logs USING gin(to_tsvector('english', coalesce(message, '')));

-- 2. Provider health view (last 24h derived from logs)
CREATE OR REPLACE VIEW public.v_provider_health AS
SELECT
  coalesce(p.name, l.source)   AS provider_name,
  l.source,
  p.handler_type,
  p.id                          AS provider_id,
  p.is_active,
  COUNT(*) FILTER (WHERE l.event = 'provider.called')                                 AS total_calls,
  COUNT(*) FILTER (WHERE l.event = 'provider.called' AND l.level = 'info')            AS successful_calls,
  COUNT(*) FILTER (WHERE l.event = 'provider.rejected')                               AS rejected_calls,
  COUNT(*) FILTER (WHERE l.level = 'error')                                           AS error_count,
  COUNT(*) FILTER (WHERE l.level = 'warn')                                            AS warn_count,
  ROUND(AVG(l.duration_ms) FILTER (WHERE l.event = 'provider.called')::numeric, 0)   AS avg_latency_ms,
  MAX(l.ts) FILTER (WHERE l.event = 'provider.called')                                AS last_call_at,
  CASE
    WHEN COUNT(*) FILTER (WHERE l.event = 'provider.called') = 0 THEN NULL
    ELSE ROUND(
      100.0 * COUNT(*) FILTER (WHERE l.event = 'provider.called' AND l.level = 'info')
            / NULLIF(COUNT(*) FILTER (WHERE l.event = 'provider.called'), 0), 1
    )
  END AS success_rate_pct
FROM public.system_logs l
LEFT JOIN public.providers p ON p.id = l.provider_id
WHERE l.ts > now() - interval '24 hours'
GROUP BY p.name, l.source, p.handler_type, p.id, p.is_active;

GRANT SELECT ON public.v_provider_health TO authenticated;

-- 3. Auto-reset stuck orders (no provider submission after 15 min → reset to paid)
CREATE OR REPLACE FUNCTION public.auto_reset_stuck_orders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.orders
  SET
    status        = 'paid',
    failure_reason = 'Auto-reset: stuck in processing without provider submission',
    updated_at    = now()
  WHERE
    status            = 'processing'
    AND provider_order_id IS NULL
    AND updated_at    < now() - interval '15 minutes'
    AND order_type    IN ('data', 'airtime');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.system_logs (level, source, event, message, data)
    VALUES (
      'warn',
      'cron-auto-retry',
      'orders.auto_reset',
      format('Auto-reset %s stuck orders back to paid for retry', v_count),
      jsonb_build_object('count', v_count, 'triggered_at', now())
    );
  END IF;

  RETURN v_count;
END;
$$;

-- 4. Error spike detector — logs a CRITICAL alert and notifies all admins
CREATE OR REPLACE FUNCTION public.check_error_spike()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_error_count  int;
  v_last_alert   timestamptz;
  v_admin        RECORD;
BEGIN
  SELECT COUNT(*) INTO v_error_count
  FROM public.system_logs
  WHERE level = 'error' AND ts > now() - interval '10 minutes';

  SELECT MAX(ts) INTO v_last_alert
  FROM public.system_logs
  WHERE event = 'alert.error_spike';

  IF v_error_count >= 5 AND (v_last_alert IS NULL OR v_last_alert < now() - interval '30 minutes') THEN
    -- Insert a visible spike alert into logs
    INSERT INTO public.system_logs (level, source, event, message, data)
    VALUES (
      'error',
      'system',
      'alert.error_spike',
      format('ALERT: %s errors in the last 10 minutes — immediate attention required', v_error_count),
      jsonb_build_object('error_count', v_error_count, 'window_minutes', 10)
    );

    -- Notify all admin users via user_notifications
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.user_notifications (user_id, title, message, type, data)
      VALUES (
        v_admin.user_id,
        '🚨 Error Spike Detected',
        format('%s system errors in the last 10 minutes. Check System Logs immediately.', v_error_count),
        'error',
        jsonb_build_object('link', '/admin/system-logs', 'error_count', v_error_count)
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- 5. Schedule with pg_cron (safe: no-op if extension not available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old jobs if they exist
    PERFORM cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname IN ('auto-reset-stuck-orders', 'check-error-spike');

    -- Auto-reset stuck orders every 5 minutes
    PERFORM cron.schedule(
      'auto-reset-stuck-orders',
      '*/5 * * * *',
      'SELECT public.auto_reset_stuck_orders()'
    );

    -- Check for error spikes every 10 minutes
    PERFORM cron.schedule(
      'check-error-spike',
      '*/10 * * * *',
      'SELECT public.check_error_spike()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available or scheduling failed — safe to ignore
  NULL;
END;
$$;
