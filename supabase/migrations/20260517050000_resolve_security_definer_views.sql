-- 20260517050000_resolve_security_definer_views.sql
-- Resolves all database security linter warnings regarding views with SECURITY DEFINER property.
-- Redefines all 9 flagged views with the `WITH (security_invoker = true)` option to enforce proper 
-- Row Level Security (RLS) constraints of the querying user.

-- 1. Redefine agent_stores view
DROP VIEW IF EXISTS public.agent_stores CASCADE;
CREATE VIEW public.agent_stores WITH (security_invoker = true) AS
SELECT 
    user_id,
    full_name,
    store_name,
    whatsapp_number,
    support_number,
    whatsapp_group_link,
    agent_prices,
    sub_agent_prices,
    disabled_packages,
    is_agent,
    is_sub_agent,
    agent_approved,
    sub_agent_approved,
    parent_agent_id,
    sub_agent_activation_markup,
    store_logo_url,
    store_primary_color,
    slug,
    email
FROM public.profiles
WHERE (is_agent = true OR is_sub_agent = true)
  AND onboarding_complete = true;

GRANT SELECT ON public.agent_stores TO anon, authenticated;

-- 2. Redefine public_system_settings view
DROP VIEW IF EXISTS public.public_system_settings CASCADE;
CREATE VIEW public.public_system_settings WITH (security_invoker = true) AS
SELECT 
  id,
  auto_api_switch,
  holiday_mode_enabled,
  holiday_message,
  disable_ordering,
  dark_mode_enabled,
  store_visitor_popup_enabled,
  customer_service_number,
  support_channel_link,
  mtn_markup_percentage,
  telecel_markup_percentage,
  at_markup_percentage,
  show_announcement,
  announcement_title,
  announcement_message,
  free_data_enabled,
  free_data_network,
  free_data_package_size,
  free_data_max_claims,
  free_data_claims_count,
  home_page_video_url,
  home_page_video_muted,
  agent_activation_fee,
  sub_agent_base_fee,
  wassce_price,
  bece_price,
  show_scrolling_ad,
  scrolling_ad_text,
  scrolling_ad_image_url,
  traditional_background_enabled,
  background_custom_image_url,
  enable_privacy_shield,
  maintenance_mode,
  maintenance_message,
  withdrawal_auto_approve_enabled,
  withdrawal_auto_approve_max_amount,
  withdrawal_auto_approve_min_age_days,
  withdrawal_auto_approve_require_no_chargebacks,
  min_withdrawal_amount,
  withdrawal_system_enabled,
  updated_at
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;

-- 3. Redefine v_provider_health view
DROP VIEW IF EXISTS public.v_provider_health CASCADE;
CREATE VIEW public.v_provider_health WITH (security_invoker = true) AS
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

-- 4. Redefine user_sales_stats view
DROP VIEW IF EXISTS public.user_sales_stats CASCADE;
CREATE VIEW public.user_sales_stats WITH (security_invoker = true) AS
WITH direct_stats AS (
    SELECT 
        agent_id as user_id, 
        COUNT(*) as total_fulfilled_orders, 
        SUM(amount) as total_sales_volume,
        SUM(profit) as total_own_profit
    FROM public.orders
    WHERE status = 'fulfilled'
      AND order_type NOT IN ('agent_activation', 'sub_agent_activation')
    GROUP BY agent_id
),
parent_stats AS (
    SELECT 
        parent_agent_id as user_id,
        SUM(parent_profit) as total_commissions_earned
    FROM public.orders
    WHERE status = 'fulfilled'
      AND parent_agent_id IS NOT NULL
    GROUP BY parent_agent_id
)
SELECT 
    p.user_id,
    COALESCE(d.total_fulfilled_orders, 0) as total_fulfilled_orders,
    COALESCE(d.total_sales_volume, 0) as total_sales_volume,
    COALESCE(d.total_own_profit, 0) as total_own_profit,
    COALESCE(pa.total_commissions_earned, 0) as total_commissions_paid
FROM public.profiles p
LEFT JOIN direct_stats d ON p.user_id = d.user_id
LEFT JOIN parent_stats pa ON p.user_id = pa.user_id;

GRANT SELECT ON public.user_sales_stats TO authenticated;

-- 5. Redefine user_mfa_status view
DROP VIEW IF EXISTS public.user_mfa_status CASCADE;
CREATE VIEW public.user_mfa_status WITH (security_invoker = true) AS
SELECT 
    user_id, 
    COUNT(*) FILTER (WHERE status = 'verified') > 0 as has_mfa
FROM auth.mfa_factors
GROUP BY user_id;

GRANT SELECT ON public.user_mfa_status TO authenticated, service_role;

-- 6. Redefine v_daily_pnl view
DROP VIEW IF EXISTS public.v_daily_pnl CASCADE;
CREATE VIEW public.v_daily_pnl WITH (security_invoker = true) AS
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
WHERE o.order_type IN ('data', 'airtime', 'utility', 'api', 'afa')
GROUP BY date_trunc('day', o.created_at)::date, o.network, o.order_type, prov.name, prov.handler_type;

GRANT SELECT ON public.v_daily_pnl TO authenticated;

-- 7. Redefine v_onboarding_funnel view
DROP VIEW IF EXISTS public.v_onboarding_funnel CASCADE;
CREATE VIEW public.v_onboarding_funnel WITH (security_invoker = true) AS
WITH cohorts AS (
  SELECT
    date_trunc('week', p.created_at)::date AS cohort_week,
    p.user_id,
    p.created_at                           AS signed_up_at,
    MIN(o.created_at) FILTER (WHERE o.order_type IN ('data','airtime','utility','api','afa'))  AS first_order_at,
    COUNT(o.id) FILTER (WHERE o.order_type IN ('data','airtime','utility','api','afa'))        AS total_orders,
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
GROUP BY cohort_week;

GRANT SELECT ON public.v_onboarding_funnel TO authenticated;

-- 8. Redefine v_agent_performance view
DROP VIEW IF EXISTS public.v_agent_performance CASCADE;
CREATE VIEW public.v_agent_performance WITH (security_invoker = true) AS
SELECT
  p.user_id                                                          AS agent_id,
  p.full_name,
  p.email,
  p.phone,
  p.is_sub_agent,
  p.parent_agent_id,
  p.created_at                                                       AS joined_at,
  p.credit_enabled,
  COALESCE(w.credit_limit, 0)::numeric(12,2)                        AS credit_limit,
  (CASE WHEN w.balance < 0 THEN -w.balance ELSE 0 END)::numeric(12,2) AS credit_used,

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
         p.parent_agent_id, p.created_at, p.credit_enabled, w.credit_limit,
         w.balance;

GRANT SELECT ON public.v_agent_performance TO authenticated;

-- 9. Redefine v_package_profitability view
DROP VIEW IF EXISTS public.v_package_profitability CASCADE;
CREATE VIEW public.v_package_profitability WITH (security_invoker = true) AS
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

  ROUND(
    100.0 * COUNT(*) FILTER (WHERE o.status = 'fulfillment_failed')
    / NULLIF(COUNT(*), 0), 1
  )                                                                     AS failure_rate_pct,

  MAX(o.created_at)                                                     AS last_sold_at

FROM public.orders o
WHERE o.order_type IN ('data', 'airtime', 'utility', 'api', 'afa')
  AND o.created_at > now() - interval '90 days'
GROUP BY o.network, o.package_size, o.order_type;

GRANT SELECT ON public.v_package_profitability TO authenticated;
