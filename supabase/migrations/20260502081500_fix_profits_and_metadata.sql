
-- Add metadata column to orders for flexible tracking (e.g. API client references)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Fix credit_order_profits RPC to handle TEXT/UUID mismatch safely
CREATE OR REPLACE FUNCTION public.credit_order_profits(p_order_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_agent_id UUID;
    v_parent_agent_id UUID;
    v_profit NUMERIC;
    v_parent_profit NUMERIC;
    v_profit_credited BOOLEAN;
    v_parent_profit_credited BOOLEAN;
    v_status TEXT;
    v_order_uuid UUID;
BEGIN
    -- Safely cast to UUID
    BEGIN
        v_order_uuid := p_order_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid order ID format');
    END;

    -- Select and lock the order row
    SELECT 
        agent_id, parent_agent_id, profit, parent_profit, 
        profit_credited, parent_profit_credited, status
    INTO 
        v_agent_id, v_parent_agent_id, v_profit, v_parent_profit, 
        v_profit_credited, v_parent_profit_credited, v_status
    FROM orders
    WHERE id = v_order_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- 1. Credit Agent Profit
    IF v_profit > 0 AND v_agent_id IS NOT NULL AND NOT COALESCE(v_profit_credited, FALSE) THEN
        UPDATE wallets SET balance = balance + v_profit WHERE agent_id = v_agent_id;
        v_profit_credited := TRUE;
    END IF;

    -- 2. Credit Parent Profit
    IF v_parent_profit > 0 AND v_parent_agent_id IS NOT NULL AND NOT COALESCE(v_parent_profit_credited, FALSE) THEN
        UPDATE wallets SET balance = balance + v_parent_profit WHERE agent_id = v_parent_agent_id;
        v_parent_profit_credited := TRUE;
    END IF;

    -- Update the order row with the new flags
    UPDATE orders 
    SET 
        profit_credited = COALESCE(v_profit_credited, FALSE),
        parent_profit_credited = COALESCE(v_parent_profit_credited, FALSE)
    WHERE id = v_order_uuid;

    RETURN jsonb_build_object(
        'success', true, 
        'profit_credited', COALESCE(v_profit_credited, FALSE), 
        'parent_profit_credited', COALESCE(v_parent_profit_credited, FALSE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
