-- ════════════════════════════════════════════════════════════
-- CRITICAL HOTFIX: WALLET BALANCE COLUMN CRASH
-- ════════════════════════════════════════════════════════════
-- Forces the debit_wallet and credit_wallet RPCs to use the
-- correct 'balance' column on the 'wallets' table instead of 
-- the non-existent 'wallet_balance' column.

CREATE OR REPLACE FUNCTION public.debit_wallet(p_agent_id UUID, p_amount DECIMAL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance DECIMAL;
    current_limit DECIMAL;
BEGIN
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
    END IF;

    SELECT balance, credit_limit INTO current_balance, current_limit 
    FROM wallets 
    WHERE agent_id = p_agent_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF (current_balance - p_amount) < (-current_limit) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Insufficient funds and credit limit',
            'balance', current_balance,
            'credit_limit', current_limit
        );
    END IF;

    UPDATE wallets 
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    RETURN json_build_object('success', true, 'new_balance', current_balance - p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_wallet(p_agent_id UUID, p_amount DECIMAL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance DECIMAL;
BEGIN
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
    END IF;

    SELECT balance INTO current_balance 
    FROM wallets 
    WHERE agent_id = p_agent_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    UPDATE wallets 
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    RETURN json_build_object('success', true, 'new_balance', current_balance + p_amount);
END;
$$;

-- Secure the RPCs
REVOKE EXECUTE ON FUNCTION public.debit_wallet(UUID, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, DECIMAL) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, DECIMAL) TO service_role;

-- Drop older signature variants (NUMERIC vs DECIMAL) to prevent Postgres "function is not unique" ambiguity errors
DROP FUNCTION IF EXISTS public.debit_wallet(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.credit_wallet(UUID, NUMERIC);
