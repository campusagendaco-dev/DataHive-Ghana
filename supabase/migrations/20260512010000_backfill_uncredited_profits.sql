-- Backfill: credit agent and parent wallets for all fulfilled orders
-- where profit_credited / parent_profit_credited was never set.
-- These are historical orders fulfilled before credit_order_profits was wired up.
-- Uses the same idempotent logic as credit_order_profits() but in bulk.

DO $$
DECLARE
  v_agent_id UUID;
  v_profit NUMERIC;
  v_row RECORD;
BEGIN

  -- 1. Credit agent profits
  FOR v_row IN
    SELECT agent_id, SUM(profit) AS total_profit
    FROM orders
    WHERE status = 'fulfilled'
      AND profit > 0
      AND (profit_credited IS NULL OR profit_credited = false)
      AND agent_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = agent_id)
    GROUP BY agent_id
  LOOP
    UPDATE wallets
    SET balance = balance + v_row.total_profit
    WHERE agent_id = v_row.agent_id;
  END LOOP;

  -- Mark all those orders as profit_credited
  UPDATE orders
  SET profit_credited = true
  WHERE status = 'fulfilled'
    AND profit > 0
    AND (profit_credited IS NULL OR profit_credited = false)
    AND agent_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM auth.users WHERE id = agent_id);

  -- 2. Credit parent profits
  FOR v_row IN
    SELECT parent_agent_id, SUM(parent_profit) AS total_profit
    FROM orders
    WHERE status = 'fulfilled'
      AND parent_profit > 0
      AND (parent_profit_credited IS NULL OR parent_profit_credited = false)
      AND parent_agent_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = parent_agent_id)
    GROUP BY parent_agent_id
  LOOP
    UPDATE wallets
    SET balance = balance + v_row.total_profit
    WHERE agent_id = v_row.parent_agent_id;
  END LOOP;

  -- Mark all those orders as parent_profit_credited
  UPDATE orders
  SET parent_profit_credited = true
  WHERE status = 'fulfilled'
    AND parent_profit > 0
    AND (parent_profit_credited IS NULL OR parent_profit_credited = false)
    AND parent_agent_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM auth.users WHERE id = parent_agent_id);

END $$;
