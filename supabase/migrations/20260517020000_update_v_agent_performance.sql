-- Redefine v_agent_performance view to correctly fetch credit metrics from the native wallets table.
-- w.credit_limit is the actual credit/float limit assigned.
-- credit_used is calculated dynamically as the negative balance (if overdrafted), or 0 otherwise.

DROP VIEW IF EXISTS public.v_agent_performance CASCADE;

CREATE VIEW public.v_agent_performance AS
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
