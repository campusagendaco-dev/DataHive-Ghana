-- Backfill: for fulfilled orders with no cost_price stored,
-- look up cost_price from global_package_settings by network+package_size,
-- then set profit = amount - cost_price and credit the wallet.

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
      o.profit_credited,
      g.cost_price
    FROM orders o
    JOIN global_package_settings g ON g.network = o.network AND g.package_size = o.package_size
    WHERE o.status = 'fulfilled'
      AND (o.profit IS NULL OR o.profit = 0)
      AND (o.cost_price IS NULL OR o.cost_price = 0)
      AND o.order_type IN ('data', 'airtime')
      AND o.agent_id IS NOT NULL
      AND o.amount > g.cost_price
      AND g.cost_price > 0
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = o.agent_id)
      AND NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.user_id = o.agent_id AND p.is_sub_agent = true
      )
  LOOP
    v_profit := ROUND(v_row.amount - v_row.cost_price, 2);

    IF v_profit > 0 THEN
      UPDATE orders
      SET profit = v_profit,
          cost_price = v_row.cost_price
      WHERE id = v_row.id;

      IF NOT COALESCE(v_row.profit_credited, false) THEN
        UPDATE wallets SET balance = balance + v_profit WHERE agent_id = v_row.agent_id;
        UPDATE orders SET profit_credited = true WHERE id = v_row.id;
      END IF;
    END IF;
  END LOOP;

END $$;
