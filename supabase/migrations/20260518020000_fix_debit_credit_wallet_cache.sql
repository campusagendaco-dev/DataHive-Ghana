-- Clean drop of any old conflicting signatures
DROP FUNCTION IF EXISTS public.debit_wallet(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.debit_wallet(UUID, DECIMAL);
DROP FUNCTION IF EXISTS public.credit_wallet(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.credit_wallet(UUID, DECIMAL);

-- Clean rebuild of debit_wallet with NUMERIC parameters
CREATE OR REPLACE FUNCTION public.debit_wallet(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance NUMERIC;
    current_limit NUMERIC;
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

-- Clean rebuild of credit_wallet with NUMERIC parameters
CREATE OR REPLACE FUNCTION public.credit_wallet(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance NUMERIC;
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
REVOKE EXECUTE ON FUNCTION public.debit_wallet(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, NUMERIC) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC) TO service_role;
