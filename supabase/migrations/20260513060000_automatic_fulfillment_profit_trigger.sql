-- ==========================================
-- 1. CREATE BULLETPROOF TRIGGER FOR PROFIT CREDITING
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_order_fulfillment_payout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Safeguard: ensure it only executes for fulfilled state
  IF NEW.status = 'fulfilled' THEN
    -- Execute the idempotent profit crediting mechanism automatically
    PERFORM public.credit_order_profits(NEW.id::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing if it somehow conflicts, though it is unique
DROP TRIGGER IF EXISTS tr_on_order_fulfilled_credit_profit ON public.orders;

-- Create the actual trigger
CREATE TRIGGER tr_on_order_fulfilled_credit_profit
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'fulfilled')
  EXECUTE FUNCTION public.handle_order_fulfillment_payout();


-- ==========================================
-- 2. INSTANT RETROACTIVE REPAIR & BACKFILL
-- ==========================================
-- This loop scans all historical fulfilled orders that bypassed credit_order_profits
-- and executes the atomic payout function for each of them instantly.

DO $$
DECLARE
  v_row RECORD;
  v_success_count INT := 0;
  v_skipped_count INT := 0;
BEGIN
  FOR v_row IN
    SELECT id, agent_id, profit, parent_profit 
    FROM public.orders
    WHERE status = 'fulfilled'
      -- Check if agent needs payout and hasn't got it
      AND (
        (profit > 0 AND agent_id IS NOT NULL AND (profit_credited IS NULL OR profit_credited = FALSE))
        OR
        -- Or if parent needs payout and hasn't got it
        (parent_profit > 0 AND parent_agent_id IS NOT NULL AND (parent_profit_credited IS NULL OR parent_profit_credited = FALSE))
      )
  LOOP
    BEGIN
      -- Call the atomic rpc for each affected row
      PERFORM public.credit_order_profits(v_row.id::TEXT);
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped_count := v_skipped_count + 1;
      RAISE WARNING 'Failed to repair profits for order ID %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Retroactive Profit Repair Complete. Successfully processed % orders. % errors/skips.', v_success_count, v_skipped_count;
END $$;
