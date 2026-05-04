-- Public stats RPC — safe aggregate counts for the homepage trust strip.
-- SECURITY DEFINER so it bypasses RLS; only returns non-sensitive aggregates.

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivered     BIGINT;
  v_failed        BIGINT;
  v_agents        BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_delivered
  FROM public.orders
  WHERE status = 'fulfilled'
    AND order_type IN ('data', 'airtime', 'utility', 'api');

  SELECT COUNT(*) INTO v_failed
  FROM public.orders
  WHERE status = 'fulfillment_failed'
    AND order_type IN ('data', 'airtime', 'utility', 'api');

  SELECT COUNT(*) INTO v_agents
  FROM public.profiles
  WHERE is_agent = true AND agent_approved = true;

  RETURN jsonb_build_object(
    'total_delivered', v_delivered,
    'success_rate',    CASE WHEN (v_delivered + v_failed) = 0 THEN 100
                            ELSE ROUND((v_delivered::NUMERIC / (v_delivered + v_failed)) * 100, 1)
                       END,
    'total_agents', v_agents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated, service_role;
