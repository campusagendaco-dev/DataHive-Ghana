-- ============================================================
-- ANALYTICS VIEWS MIGRATION
-- Agent performance, P&L, onboarding funnel, package profitability
-- ============================================================

-- ─────────────────────────────────────────
-- 1. AGENT PERFORMANCE VIEW (30-day rolling)
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_agent_performance AS
SELECT
  p.user_id                                                          AS agent_id,
  p.full_name,
  p.email,
  p.phone,
  p.is_sub_agent,
  p.parent_agent_id,
  p.created_at                                                       AS joined_at,
  p.credit_enabled,
  p.credit_limit,
  p.credit_used,

  -- 30-day stats
  COUNT(o.id) FILTER (WHERE o.created_at > now() - interval '30 days')                     AS orders_30d,
  COUNT(o.id) FILTER (WHERE o.status = 'fulfilled' AND o.created_at > now() - interval '30 days') AS fulfilled_30d,
  COUNT(o.id) FILTER (WHERE o.status = 'fulfillment_failed' AND o.created_at > now() - interval '30 days') AS failed_30d,

  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled' AND o.created_at > now() - interval '30 days'), 0) AS revenue_30d,
  COALESCE(SUM(o.profit) FILTER (WHERE o.status = 'fulfilled' AND o.created_at > now() - interval '30 days'), 0) AS profit_30d,

  -- 7-day stats
  COUNT(o.id) FILTER (WHERE o.created_at > now() - interval '7 days')                      AS orders_7d,
  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled' AND o.created_at > now() - interval '7 days'), 0) AS revenue_7d,

  -- All-time
  COUNT(o.id)                                                        AS orders_total,
  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0)  AS revenue_total,
  COALESCE(SUM(o.profit) FILTER (WHERE o.status = 'fulfilled'), 0)  AS profit_total,

  -- Last active
  MAX(o.created_at)                                                  AS last_order_at,
  EXTRACT(DAY FROM now() - MAX(o.created_at))::int                  AS days_since_last_order,

  -- Wallet balance
  COALESCE(w.balance, 0)                                            AS wallet_balance,

  -- Top network (last 30d)
  MODE() WITHIN GROUP (ORDER BY o.network) FILTER (
    WHERE o.created_at > now() - interval '30 days' AND o.status = 'fulfilled'
  )                                                                  AS top_network

FROM public.profiles p
LEFT JOIN public.orders o ON o.agent_id = p.user_id AND o.order_type IN ('data', 'airtime')
LEFT JOIN public.wallets w ON w.agent_id = p.user_id
WHERE p.is_agent = true OR p.sub_agent_approved = true
GROUP BY p.user_id, p.full_name, p.email, p.phone, p.is_sub_agent,
         p.parent_agent_id, p.created_at, p.credit_enabled, p.credit_limit,
         p.credit_used, w.balance;

GRANT SELECT ON public.v_agent_performance TO authenticated;

-- ─────────────────────────────────────────
-- 2. FINANCIAL P&L VIEW (daily)
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_daily_pnl AS
SELECT
  date_trunc('day', o.created_at)::date          AS report_date,
  o.network,
  o.order_type,
  prov.name                                       AS provider_name,
  prov.handler_type,

  COUNT(*)                                        AS total_orders,
  COUNT(*) FILTER (WHERE o.status = 'fulfilled')  AS fulfilled_orders,
  COUNT(*) FILTER (WHERE o.status = 'fulfillment_failed') AS failed_orders,

  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0)      AS gross_revenue,
  COALESCE(SUM(o.cost_price) FILTER (WHERE o.status = 'fulfilled'), 0)  AS total_cost,
  COALESCE(SUM(o.profit) FILTER (WHERE o.status = 'fulfilled'), 0)      AS agent_profits,
  COALESCE(SUM(o.parent_profit) FILTER (WHERE o.status = 'fulfilled'), 0) AS parent_profits,

  -- Net margin = revenue - cost - profits paid out
  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0)
    - COALESCE(SUM(o.cost_price) FILTER (WHERE o.status = 'fulfilled'), 0) AS gross_profit,

  CASE
    WHEN COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0) > 0 THEN
      ROUND(100.0 *
        (COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0)
         - COALESCE(SUM(o.cost_price) FILTER (WHERE o.status = 'fulfilled'), 0))
        / NULLIF(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0), 2)
    ELSE 0
  END AS margin_pct,

  COALESCE(SUM(o.paystack_fee) FILTER (WHERE o.status = 'fulfilled'), 0) AS paystack_fees

FROM public.orders o
LEFT JOIN public.providers prov ON prov.id = o.provider_id
WHERE o.order_type IN ('data', 'airtime')
GROUP BY date_trunc('day', o.created_at)::date, o.network, o.order_type, prov.name, prov.handler_type
ORDER BY report_date DESC, gross_revenue DESC;

GRANT SELECT ON public.v_daily_pnl TO authenticated;

-- ─────────────────────────────────────────
-- 3. AGENT ONBOARDING FUNNEL VIEW
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_onboarding_funnel AS
WITH cohorts AS (
  SELECT
    date_trunc('week', p.created_at)::date AS cohort_week,
    p.user_id,
    p.created_at                           AS signed_up_at,
    MIN(o.created_at) FILTER (WHERE o.order_type IN ('data','airtime'))  AS first_order_at,
    COUNT(o.id) FILTER (WHERE o.order_type IN ('data','airtime'))        AS total_orders,
    (p.is_agent OR p.sub_agent_approved)                                 AS is_activated
  FROM public.profiles p
  LEFT JOIN public.orders o ON o.agent_id = p.user_id
  GROUP BY p.user_id, p.created_at, p.is_agent, p.sub_agent_approved
)
SELECT
  cohort_week,
  COUNT(*)                                           AS signups,
  COUNT(*) FILTER (WHERE is_activated)               AS activated,
  COUNT(*) FILTER (WHERE first_order_at IS NOT NULL) AS placed_first_order,
  COUNT(*) FILTER (WHERE total_orders >= 5)          AS retained_5plus,
  COUNT(*) FILTER (WHERE total_orders >= 20)         AS retained_20plus,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_activated) / NULLIF(COUNT(*), 0), 1) AS activation_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE first_order_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS first_order_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE total_orders >= 5) / NULLIF(COUNT(*), 0), 1) AS retention_rate_pct
FROM cohorts
GROUP BY cohort_week
ORDER BY cohort_week DESC;

GRANT SELECT ON public.v_onboarding_funnel TO authenticated;

-- ─────────────────────────────────────────
-- 4. PACKAGE PROFITABILITY VIEW
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_package_profitability AS
SELECT
  o.network,
  o.package_size,
  o.order_type,

  COUNT(*) FILTER (WHERE o.status = 'fulfilled')        AS fulfilled_count,
  COUNT(*) FILTER (WHERE o.status = 'fulfillment_failed') AS failed_count,

  ROUND(AVG(o.amount) FILTER (WHERE o.status = 'fulfilled'), 2)        AS avg_selling_price,
  ROUND(AVG(o.cost_price) FILTER (WHERE o.status = 'fulfilled'), 2)    AS avg_cost_price,
  ROUND(AVG(o.profit) FILTER (WHERE o.status = 'fulfilled'), 2)        AS avg_profit,

  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0)     AS total_revenue,
  COALESCE(SUM(o.profit) FILTER (WHERE o.status = 'fulfilled'), 0)     AS total_profit,

  ROUND(
    100.0 * COALESCE(SUM(o.profit) FILTER (WHERE o.status = 'fulfilled'), 0)
    / NULLIF(SUM(o.amount) FILTER (WHERE o.status = 'fulfilled'), 0), 2
  )                                                                     AS profit_margin_pct,

  -- Failure rate
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE o.status = 'fulfillment_failed')
    / NULLIF(COUNT(*), 0), 1
  )                                                                     AS failure_rate_pct,

  MAX(o.created_at)                                                     AS last_sold_at

FROM public.orders o
WHERE o.order_type IN ('data', 'airtime')
  AND o.created_at > now() - interval '90 days'
GROUP BY o.network, o.package_size, o.order_type
ORDER BY total_revenue DESC;

GRANT SELECT ON public.v_package_profitability TO authenticated;

-- ─────────────────────────────────────────
-- 5. FRAUD FLAGS RLS for agents (read own)
-- ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'fraud_flags' AND policyname = 'agents_read_own_fraud_flags'
  ) THEN
    EXECUTE 'CREATE POLICY "agents_read_own_fraud_flags" ON public.fraud_flags FOR SELECT USING (agent_id = auth.uid())';
  END IF;
END $$;
