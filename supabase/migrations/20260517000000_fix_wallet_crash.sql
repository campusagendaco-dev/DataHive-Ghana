-- ════════════════════════════════════════════════════════════
-- CRITICAL FIX: RESTORE NATIVE DEBIT WALLET & FLOAT
-- ════════════════════════════════════════════════════════════
-- Explanation: The previous micro_credit.sql migration mistakenly 
-- pointed the debit_wallet function to the 'profiles' table, looking 
-- for a 'wallet_balance' column that doesn't exist there. 
-- The wallets and the float system (via 'credit_limit' and negative balances) 
-- actually live securely in the 'wallets' table!
-- This script restores the ultra-secure native logic.

-- 1. Restore the correct debit_wallet function
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
    -- Hard fail on negative or zero inputs to prevent cash generation exploits
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
    END IF;

    -- Get current balance and credit limit with an exclusive row lock
    SELECT balance, credit_limit INTO current_balance, current_limit 
    FROM wallets 
    WHERE agent_id = p_agent_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- Enforce credit limit (overdraft bound). 
    -- The float system works perfectly by allowing the balance to safely go negative up to the limit!
    IF (current_balance - p_amount) < (-current_limit) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Insufficient funds and credit limit',
            'balance', current_balance,
            'credit_limit', current_limit
        );
    END IF;

    -- Update balance
    UPDATE wallets 
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    RETURN json_build_object(
        'success', true, 
        'new_balance', current_balance - p_amount
    );
END;
$$;

-- 2. Drop the redundant repay_credit function that was created previously
DROP FUNCTION IF EXISTS public.repay_credit(UUID, NUMERIC);

-- 3. Cleanup unused columns from profiles
-- (Skipping DROP COLUMN to prevent breaking dependent views like v_agent_performance)
