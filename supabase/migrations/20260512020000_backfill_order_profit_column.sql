-- Backfill: fix profit = 0 on fulfilled wallet orders for regular agents.
-- For orders where cost_price > 0 and profit = 0 and agent is not a sub-agent,
-- profit should be amount - cost_price.
-- Also credit the delta to the agent's wallet (they were effectively overcharged).

DO $$
DECLARE
  v_row RECORD;
  v_profit NUMERIC;
BEGIN

  FOR v_row IN
    SELECT
      o.id,
      o.agent_id,
      o.amount,
      o.cost_price,
      o.profit_credited
    FROM orders o
    WHERE o.status = 'fulfilled'
      AND (o.profit IS NULL OR o.profit = 0)
      AND o.cost_price > 0
      AND o.amount > o.cost_price
      AND o.order_type IN ('data', 'airtime')
      AND o.agent_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = o.agent_id)
      -- Exclude sub-agent orders (they correctly have profit=0)
      AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = o.agent_id AND p.is_sub_agent = true
      )
  LOOP
    v_profit := ROUND(v_row.amount - v_row.cost_price, 2);

    IF v_profit > 0 THEN
      -- Update profit on the order
      UPDATE orders
      SET profit = v_profit,
          profit_credited = COALESCE(profit_credited, false)
      WHERE id = v_row.id;

      -- Credit the profit to the agent's wallet if not already credited
      IF NOT COALESCE(v_row.profit_credited, false) THEN
        UPDATE wallets SET balance = balance + v_profit WHERE agent_id = v_row.agent_id;
        UPDATE orders SET profit_credited = true WHERE id = v_row.id;
      END IF;
    END IF;
  END LOOP;

END $$;
