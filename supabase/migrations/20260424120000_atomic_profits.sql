-- Add flags to track profit crediting to prevent double-crediting
ALTER TABLE orders ADD COLUMN IF NOT EXISTS profit_credited BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_profit_credited BOOLEAN DEFAULT FALSE;

-- Create an atomic function to credit profits for an order
CREATE OR REPLACE FUNCTION credit_order_profits(p_order_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_agent_id UUID;
    v_parent_agent_id UUID;
    v_profit NUMERIC;
    v_parent_profit NUMERIC;
    v_profit_credited BOOLEAN;
    v_parent_profit_credited BOOLEAN;
    v_status TEXT;
BEGIN
    -- Select and lock the order row
    SELECT 
        agent_id, parent_agent_id, profit, parent_profit, 
        profit_credited, parent_profit_credited, status
    INTO 
        v_agent_id, v_parent_agent_id, v_profit, v_parent_profit, 
        v_profit_credited, v_parent_profit_credited, v_status
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Only credit if the order is fulfilled or in a paid/processing state
    -- And only if it hasn't been credited yet
    
    -- 1. Credit Agent Profit
    IF v_profit > 0 AND v_agent_id IS NOT NULL AND NOT v_profit_credited THEN
        UPDATE wallets SET balance = balance + v_profit WHERE agent_id = v_agent_id;
        v_profit_credited := TRUE;
    END IF;

    -- 2. Credit Parent Profit
    IF v_parent_profit > 0 AND v_parent_agent_id IS NOT NULL AND NOT v_parent_profit_credited THEN
        UPDATE wallets SET balance = balance + v_parent_profit WHERE agent_id = v_parent_agent_id;
        v_parent_profit_credited := TRUE;
    END IF;

    -- Update the order row with the new flags
    UPDATE orders 
    SET 
        profit_credited = v_profit_credited,
        parent_profit_credited = v_parent_profit_credited
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true, 
        'profit_credited', v_profit_credited, 
        'parent_profit_credited', v_parent_profit_credited
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
