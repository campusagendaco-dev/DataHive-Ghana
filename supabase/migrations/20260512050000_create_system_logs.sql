-- System logs table for full platform observability
-- Captures provider API calls, webhook events, order transitions, and errors

CREATE TABLE IF NOT EXISTS public.system_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ts          timestamptz DEFAULT now() NOT NULL,
  level       text        NOT NULL DEFAULT 'info',   -- info | warn | error
  source      text        NOT NULL,                  -- verify-payment | datahub-webhook | wallet-buy-data | admin
  event       text        NOT NULL,                  -- order.fulfilled | provider.called | webhook.received | error
  order_id    uuid,
  agent_id    uuid,
  provider_id uuid,
  message     text        NOT NULL,
  data        jsonb,
  duration_ms int
);

-- Performance indexes for common filter/query patterns
CREATE INDEX IF NOT EXISTS idx_system_logs_ts          ON public.system_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level       ON public.system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source      ON public.system_logs (source);
CREATE INDEX IF NOT EXISTS idx_system_logs_event       ON public.system_logs (event);
CREATE INDEX IF NOT EXISTS idx_system_logs_order_id    ON public.system_logs (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_logs_agent_id    ON public.system_logs (agent_id) WHERE agent_id IS NOT NULL;

-- RLS: only admins can read, edge functions use service role (bypasses RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_system_logs"
  ON public.system_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-cleanup function: purge logs older than 30 days
CREATE OR REPLACE FUNCTION public.purge_old_system_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.system_logs WHERE ts < now() - interval '30 days';
END;
$$;
