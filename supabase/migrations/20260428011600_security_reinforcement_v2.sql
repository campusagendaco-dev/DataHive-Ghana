-- SECURITY REINFORCEMENT V2

-- 1. Fix Profile RLS Loophole (Prevent Self-Promotion)
-- We replace the overly broad policy with one that checks if sensitive fields are being changed.
DROP POLICY IF EXISTS "Users update own safe fields" ON public.profiles;
CREATE POLICY "Users update own safe fields" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    auth.uid() = user_id 
    AND (
      -- Only allow updates if these sensitive fields remain identical to their current values
      is_agent = (SELECT is_agent FROM public.profiles WHERE user_id = auth.uid()) AND
      agent_approved = (SELECT agent_approved FROM public.profiles WHERE user_id = auth.uid()) AND
      is_sub_agent = (SELECT is_sub_agent FROM public.profiles WHERE user_id = auth.uid()) AND
      sub_agent_approved = (SELECT sub_agent_approved FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 2. Fix Loyalty System Negative Injection
CREATE OR REPLACE FUNCTION public.convert_loyalty_points(user_id UUID, points_to_convert DECIMAL)
RETURNS JSONB AS $$
DECLARE
    wallet_row RECORD;
    cash_value DECIMAL;
BEGIN
    -- CRITICAL FIX: Prevent negative values
    IF points_to_convert <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid points amount');
    END IF;

    SELECT * INTO wallet_row FROM public.wallets WHERE agent_id = user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    IF wallet_row.loyalty_balance < points_to_convert THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient loyalty balance');
    END IF;
    
    -- Calculate cash value (100 points = 1 GHS)
    cash_value := points_to_convert / 100;
    
    -- Perform atomic update
    UPDATE public.wallets
    SET 
        loyalty_balance = loyalty_balance - points_to_convert,
        balance = balance + cash_value
    WHERE agent_id = user_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'converted_points', points_to_convert, 
        'cash_added', cash_value,
        'new_balance', wallet_row.balance + cash_value,
        'new_loyalty_balance', wallet_row.loyalty_balance - points_to_convert
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. New Atomic Function for Admin to Confirm Withdrawals
-- This ensures the status change AND the wallet deduction happen together.
CREATE OR REPLACE FUNCTION public.finalize_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_agent_id UUID;
    v_amount NUMERIC;
    v_status TEXT;
    v_wallet_balance NUMERIC;
BEGIN
    -- 1. Lock the withdrawal record
    SELECT agent_id, amount, status INTO v_agent_id, v_amount, v_status
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
    END IF;

    IF v_status <> 'pending' AND v_status <> 'processing' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is already ' || v_status);
    END IF;

    -- 2. Lock the wallet
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE agent_id = v_agent_id
    FOR UPDATE;

    IF v_wallet_balance < v_amount THEN
        -- We still allow it but mark the wallet as negative? 
        -- Better to prevent it if the user spent their profit before confirmation.
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance to fulfill withdrawal. User may have spent their profit.');
    END IF;

    -- 3. Perform atomic updates
    UPDATE public.wallets
    SET balance = balance - v_amount
    WHERE agent_id = v_agent_id;

    UPDATE public.withdrawals
    SET status = 'completed', completed_at = now()
    WHERE id = p_withdrawal_id;

    -- 4. Create an audit trail in orders
    INSERT INTO public.orders (agent_id, order_type, amount, profit, status, failure_reason)
    VALUES (v_agent_id, 'withdrawal', v_amount, 0, 'fulfilled', 'Cash withdrawal confirmed');

    RETURN jsonb_build_object('success', true, 'new_balance', v_wallet_balance - v_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_withdrawal(UUID) TO service_role;
