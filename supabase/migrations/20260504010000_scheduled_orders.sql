-- Auto-renewal / scheduled bundle orders
CREATE TABLE IF NOT EXISTS public.scheduled_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network          TEXT        NOT NULL,
  package_size     TEXT        NOT NULL,
  recipient_phone  TEXT        NOT NULL,
  frequency        TEXT        NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  next_run_at      TIMESTAMPTZ NOT NULL,
  active           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at      TIMESTAMPTZ,
  failure_count    INT         NOT NULL DEFAULT 0
);

ALTER TABLE public.scheduled_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedules"
  ON public.scheduled_orders
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all (for cron runner)
CREATE POLICY "Service role reads all schedules"
  ON public.scheduled_orders
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE INDEX idx_scheduled_orders_next_run ON public.scheduled_orders (next_run_at) WHERE active = true;
