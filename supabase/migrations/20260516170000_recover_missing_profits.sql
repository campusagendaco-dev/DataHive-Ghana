-- Comprehensive Profit Recovery & Wallet Synchronization
-- 1. Fix missing parent_agent_id on orders placed by sub-agents
-- 2. Recalculate parent_profit for sub-agent orders if it was missed (using base fee logic)
-- 3. Credit all uncredited profits to wallets (idempotent)

DO $$
DECLARE
  v_fix_count INT := 0;
  v_credit_count INT := 0;
  v_parent_profit NUMERIC;
  v_row RECORD;
BEGIN
  -- Phase 1: Repair missing parent_agent_id references on historical orders
  -- This happens if a sub-agent was registered after the order or if the join failed during order creation
  FOR v_row IN
    SELECT o.id, p.parent_agent_id
    FROM public.orders o
    JOIN public.profiles p ON o.agent_id = p.user_id
    WHERE o.parent_agent_id IS NULL
      AND p.parent_agent_id IS NOT NULL
      AND o.status = 'fulfilled'
  LOOP
    UPDATE public.orders 
    SET parent_agent_id = v_row.parent_agent_id 
    WHERE id = v_row.id;
    v_fix_count := v_fix_count + 1;
  END LOOP;

  RAISE NOTICE 'Repaired % missing parent_agent_id references.', v_fix_count;

  -- Phase 2: Recalculate missing parent_profit (Commission)
  -- If we have a parent_agent_id but parent_profit is 0 or NULL, we try to recover it.
  FOR v_row IN
    SELECT o.id, o.amount, o.profit, o.network, o.package_size, g.agent_price
    FROM public.orders o
    LEFT JOIN public.global_package_settings g ON o.network = g.network AND o.package_size = g.package_size
    WHERE o.parent_agent_id IS NOT NULL
      AND (o.parent_profit IS NULL OR o.parent_profit = 0)
      AND o.status = 'fulfilled'
      AND o.order_type IN ('data', 'airtime', 'api')
  LOOP
    -- Parent profit: difference between sub-agent price and admin wholesale (agent_price)
    v_parent_profit := GREATEST(0.05, COALESCE(v_row.amount - v_row.agent_price, 0.10));
    
    UPDATE public.orders 
    SET parent_profit = v_parent_profit 
    WHERE id = v_row.id;
  END LOOP;

  -- Phase 3: Credit all uncredited profits to wallets (idempotent)
  FOR v_row IN
    SELECT id
    FROM public.orders
    WHERE status = 'fulfilled'
      AND (
        (COALESCE(profit, 0) > 0 AND (profit_credited IS NULL OR profit_credited = false))
        OR
        (COALESCE(parent_profit, 0) > 0 AND parent_agent_id IS NOT NULL AND (parent_profit_credited IS NULL OR parent_profit_credited = false))
      )
  LOOP
    BEGIN
      -- Execute atomic payout
      PERFORM public.credit_order_profits(v_row.id::TEXT);
      v_credit_count := v_credit_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to credit profits for order %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Successfully credited profits for % orders.', v_credit_count;

END $$;
