-- ================================================================
-- SWIFTDATA MASTER FIX — Safe to run multiple times
-- Applies all missing infrastructure + corrects all broken RLS
-- ================================================================


-- ── 1. user_notifications: data column + policies ───────────────
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS data jsonb;

DROP POLICY IF EXISTS "admins_insert_user_notifications" ON public.user_notifications;
CREATE POLICY "admins_insert_user_notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "service_role_insert_notifications" ON public.user_notifications;
CREATE POLICY "service_role_insert_notifications"
  ON public.user_notifications FOR INSERT
  TO service_role WITH CHECK (true);


-- ── 2. system_logs: admin insert policy ─────────────────────────
DROP POLICY IF EXISTS "admins_insert_system_logs" ON public.system_logs;
CREATE POLICY "admins_insert_system_logs"
  ON public.system_logs FOR INSERT
  WITH CHECK (public.is_admin());


-- ── 3. Sentinel core tables ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sentinel_knowledge (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at          timestamptz DEFAULT now(),
    pattern_hash        text UNIQUE,
    error_signature     text NOT NULL,
    diagnosis           text,
    recommended_action  text,
    success_count       int DEFAULT 0,
    failure_count       int DEFAULT 0,
    last_applied_at     timestamptz,
    is_verified         boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.sentinel_strategies (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at          timestamptz DEFAULT now(),
    name                text NOT NULL,
    condition_prompt    text NOT NULL,
    action_template     jsonb NOT NULL DEFAULT '{}',
    confidence_score    float DEFAULT 0.5,
    version             int DEFAULT 1,
    is_active           boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.sentinel_actions (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ts                  timestamptz DEFAULT now(),
    log_id              uuid REFERENCES public.system_logs(id),
    strategy_id         uuid REFERENCES public.sentinel_strategies(id),
    action_type         text NOT NULL,
    status              text DEFAULT 'pending',
    effectiveness       int DEFAULT 0,
    reasoning           text,
    result              jsonb,
    metadata            jsonb
);

CREATE INDEX IF NOT EXISTS idx_sentinel_knowledge_hash ON public.sentinel_knowledge(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_sentinel_actions_ts ON public.sentinel_actions(ts DESC);
CREATE INDEX IF NOT EXISTS idx_sentinel_actions_status ON public.sentinel_actions(status);


-- ── 4. Security tables ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sentinel_security_audits (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ts          timestamptz DEFAULT now(),
    severity    text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    event_type  text,
    description text,
    attacker_info jsonb,
    action_taken  text,
    is_resolved   boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.blocked_ips (
    ip_address  text PRIMARY KEY,
    reason      text,
    blocked_at  timestamptz DEFAULT now(),
    expires_at  timestamptz,
    blocked_by  text DEFAULT 'sentinel-ai'
);


-- ── 5. Growth suite ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sentinel_marketing_promos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text UNIQUE,
    discount_percent numeric,
    expires_at      timestamptz,
    target_user_id  uuid REFERENCES auth.users(id),
    is_used         boolean DEFAULT false,
    created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_loyalty_metrics (
    user_id             uuid PRIMARY KEY REFERENCES auth.users(id),
    monthly_volume      numeric DEFAULT 0,
    days_since_last_order integer DEFAULT 0,
    loyalty_tier        text DEFAULT 'Standard'
        CHECK (loyalty_tier IN ('Standard', 'Bronze', 'Silver', 'Gold', 'VIP')),
    last_evaluation     timestamptz DEFAULT now()
);


-- ── 6. Budget guardian columns on system_settings ───────────────
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS sentinel_monthly_budget_usd      numeric DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS sentinel_current_month_cost_usd  numeric DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sentinel_budget_alert_threshold  numeric DEFAULT 0.80,
  ADD COLUMN IF NOT EXISTS sentinel_low_power_mode          boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sentinel_usage_logs (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    day            date DEFAULT CURRENT_DATE,
    tokens_used    integer DEFAULT 0,
    cost_usd       numeric DEFAULT 0,
    function_calls integer DEFAULT 1,
    UNIQUE(day)
);


-- ── 7. increment_sentinel_cost RPC ──────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_sentinel_cost(amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.system_settings
    SET
        sentinel_current_month_cost_usd = sentinel_current_month_cost_usd + amount,
        sentinel_low_power_mode = CASE
            WHEN (sentinel_current_month_cost_usd + amount) >=
                 (sentinel_monthly_budget_usd * sentinel_budget_alert_threshold)
            THEN true
            ELSE sentinel_low_power_mode
        END
    WHERE id = 1;

    INSERT INTO public.sentinel_usage_logs (day, cost_usd, function_calls)
    VALUES (CURRENT_DATE, amount, 1)
    ON CONFLICT (day) DO UPDATE
    SET cost_usd       = sentinel_usage_logs.cost_usd + EXCLUDED.cost_usd,
        function_calls = sentinel_usage_logs.function_calls + 1;
END;
$$;


-- ── 8. ai_support_knowledge ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_support_knowledge (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    question   text NOT NULL,
    answer     text NOT NULL,
    created_at timestamptz DEFAULT now()
);


-- ── 9. Enable RLS on all new tables ─────────────────────────────
ALTER TABLE public.sentinel_knowledge         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_strategies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_actions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_security_audits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_marketing_promos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_loyalty_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_usage_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_support_knowledge       ENABLE ROW LEVEL SECURITY;


-- ── 10. Drop all broken old policies ────────────────────────────
DROP POLICY IF EXISTS "admins_manage_sentinel_knowledge"   ON public.sentinel_knowledge;
DROP POLICY IF EXISTS "admins_manage_sentinel_strategies"  ON public.sentinel_strategies;
DROP POLICY IF EXISTS "admins_manage_sentinel_actions"     ON public.sentinel_actions;
DROP POLICY IF EXISTS "Admins can view security audits"    ON public.sentinel_security_audits;
DROP POLICY IF EXISTS "Admins can manage growth suite"     ON public.sentinel_marketing_promos;
DROP POLICY IF EXISTS "Admins can view usage logs"         ON public.sentinel_usage_logs;
DROP POLICY IF EXISTS "admins_manage_knowledge"            ON public.ai_support_knowledge;
DROP POLICY IF EXISTS "service_role_knowledge"             ON public.ai_support_knowledge;


-- ── 11. Correct RLS policies (admin + service_role) ─────────────

-- sentinel_knowledge
DROP POLICY IF EXISTS "admins_sentinel_knowledge" ON public.sentinel_knowledge;
CREATE POLICY "admins_sentinel_knowledge"
  ON public.sentinel_knowledge FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_sentinel_knowledge" ON public.sentinel_knowledge;
CREATE POLICY "service_role_sentinel_knowledge"
  ON public.sentinel_knowledge TO service_role USING (true) WITH CHECK (true);

-- sentinel_strategies
DROP POLICY IF EXISTS "admins_sentinel_strategies" ON public.sentinel_strategies;
CREATE POLICY "admins_sentinel_strategies"
  ON public.sentinel_strategies FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_sentinel_strategies" ON public.sentinel_strategies;
CREATE POLICY "service_role_sentinel_strategies"
  ON public.sentinel_strategies TO service_role USING (true) WITH CHECK (true);

-- sentinel_actions
DROP POLICY IF EXISTS "admins_sentinel_actions" ON public.sentinel_actions;
CREATE POLICY "admins_sentinel_actions"
  ON public.sentinel_actions FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_sentinel_actions" ON public.sentinel_actions;
CREATE POLICY "service_role_sentinel_actions"
  ON public.sentinel_actions TO service_role USING (true) WITH CHECK (true);

-- sentinel_security_audits
DROP POLICY IF EXISTS "admins_sentinel_security_audits" ON public.sentinel_security_audits;
CREATE POLICY "admins_sentinel_security_audits"
  ON public.sentinel_security_audits FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_sentinel_security_audits" ON public.sentinel_security_audits;
CREATE POLICY "service_role_sentinel_security_audits"
  ON public.sentinel_security_audits TO service_role USING (true) WITH CHECK (true);

-- blocked_ips
DROP POLICY IF EXISTS "admins_blocked_ips" ON public.blocked_ips;
CREATE POLICY "admins_blocked_ips"
  ON public.blocked_ips FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_blocked_ips" ON public.blocked_ips;
CREATE POLICY "service_role_blocked_ips"
  ON public.blocked_ips TO service_role USING (true) WITH CHECK (true);

-- sentinel_marketing_promos
DROP POLICY IF EXISTS "admins_sentinel_marketing_promos" ON public.sentinel_marketing_promos;
CREATE POLICY "admins_sentinel_marketing_promos"
  ON public.sentinel_marketing_promos FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_sentinel_marketing_promos" ON public.sentinel_marketing_promos;
CREATE POLICY "service_role_sentinel_marketing_promos"
  ON public.sentinel_marketing_promos TO service_role USING (true) WITH CHECK (true);

-- agent_loyalty_metrics
DROP POLICY IF EXISTS "admins_agent_loyalty_metrics" ON public.agent_loyalty_metrics;
CREATE POLICY "admins_agent_loyalty_metrics"
  ON public.agent_loyalty_metrics FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_agent_loyalty_metrics" ON public.agent_loyalty_metrics;
CREATE POLICY "service_role_agent_loyalty_metrics"
  ON public.agent_loyalty_metrics TO service_role USING (true) WITH CHECK (true);

-- sentinel_usage_logs
DROP POLICY IF EXISTS "admins_sentinel_usage_logs" ON public.sentinel_usage_logs;
CREATE POLICY "admins_sentinel_usage_logs"
  ON public.sentinel_usage_logs FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "service_role_sentinel_usage_logs" ON public.sentinel_usage_logs;
CREATE POLICY "service_role_sentinel_usage_logs"
  ON public.sentinel_usage_logs TO service_role USING (true) WITH CHECK (true);

-- ai_support_knowledge
DROP POLICY IF EXISTS "admins_manage_knowledge" ON public.ai_support_knowledge;
CREATE POLICY "admins_manage_knowledge"
  ON public.ai_support_knowledge FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "service_role_knowledge" ON public.ai_support_knowledge;
CREATE POLICY "service_role_knowledge"
  ON public.ai_support_knowledge TO service_role USING (true) WITH CHECK (true);


-- ── 12. Realtime publications ────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sentinel_actions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sentinel_strategies;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sentinel_security_audits;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_ips;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sentinel_marketing_promos;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_loyalty_metrics;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ── 13. Cron: Sentinel always-on worker ─────────────────────────
-- Requires pg_cron + pg_net extensions (enabled by default in Supabase)
-- NOTE: Service role key is stored in vault.secrets (name = 'supabase_service_role')
-- Run the patch migration 20260514210000_fix_cron_use_vault.sql to set this up.
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
