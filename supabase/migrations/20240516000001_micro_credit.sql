-- Add credit fields to profiles if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS credit_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_used NUMERIC DEFAULT 0;

-- Redefine debit_wallet to support Micro-Credit (Float)
CREATE OR REPLACE FUNCTION public.debit_wallet(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON AS $$
DECLARE
    v_balance NUMERIC;
    v_credit_enabled BOOLEAN;
    v_credit_limit NUMERIC;
    v_credit_used NUMERIC;
    v_available_credit NUMERIC;
    v_amount_to_deduct_from_balance NUMERIC;
    v_amount_to_deduct_from_credit NUMERIC;
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT wallet_balance, credit_enabled, credit_limit, credit_used
    INTO v_balance, v_credit_enabled, v_credit_limit, v_credit_used
    FROM public.profiles
    WHERE user_id = p_agent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Agent not found');
    END IF;

    v_available_credit := CASE WHEN v_credit_enabled THEN (v_credit_limit - v_credit_used) ELSE 0 END;

    -- Check if totally insufficient
    IF (v_balance + v_available_credit) < p_amount THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient funds and credit limit');
    END IF;

    -- Calculate deductions
    IF v_balance >= p_amount THEN
        v_amount_to_deduct_from_balance := p_amount;
        v_amount_to_deduct_from_credit := 0;
    ELSE
        v_amount_to_deduct_from_balance := v_balance;
        v_amount_to_deduct_from_credit := p_amount - v_balance;
    END IF;

    -- Perform the deduction
    UPDATE public.profiles
    SET 
        wallet_balance = wallet_balance - v_amount_to_deduct_from_balance,
        credit_used = credit_used + v_amount_to_deduct_from_credit
    WHERE user_id = p_agent_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Wallet debited successfully', 
        'balance_deducted', v_amount_to_deduct_from_balance,
        'credit_deducted', v_amount_to_deduct_from_credit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create repayment RPC
CREATE OR REPLACE FUNCTION public.repay_credit(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON AS $$
DECLARE
    v_credit_used NUMERIC;
    v_amount_to_repay NUMERIC;
    v_remaining NUMERIC;
BEGIN
    SELECT credit_used INTO v_credit_used FROM public.profiles WHERE user_id = p_agent_id FOR UPDATE;
    
    IF v_credit_used <= 0 THEN
        -- No credit to repay, just add to wallet
        UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE user_id = p_agent_id;
        RETURN json_build_object('success', true, 'message', 'Added to wallet, no credit to repay');
    END IF;

    v_amount_to_repay := LEAST(v_credit_used, p_amount);
    v_remaining := p_amount - v_amount_to_repay;

    UPDATE public.profiles
    SET 
        credit_used = credit_used - v_amount_to_repay,
        wallet_balance = wallet_balance + v_remaining
    WHERE user_id = p_agent_id;

    RETURN json_build_object('success', true, 'message', 'Credit repaid successfully', 'repaid', v_amount_to_repay, 'wallet_added', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
