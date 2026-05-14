-- Update request_withdrawal RPC to use a more sustainable fee structure
-- New logic: GHS 1.00 (to cover Paystack transfer fee) + 1% of the amount.

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_profit          NUMERIC;
    v_total_withdrawn       NUMERIC;
    v_wallet_balance        NUMERIC;
    v_available_to_withdraw NUMERIC;
    v_withdrawal_id         UUID;
    v_fee                   NUMERIC;
    v_net_amount            NUMERIC;
    v_min_withdrawal        NUMERIC;
    v_max_withdrawal        NUMERIC;
    v_system_enabled        BOOLEAN;
    v_status                TEXT := 'pending';
BEGIN
    SELECT
      COALESCE(min_withdrawal_amount, 25.00),
      COALESCE(max_withdrawal_amount, 5000.00),
      COALESCE(withdrawal_system_enabled, true)
    INTO v_min_withdrawal, v_max_withdrawal, v_system_enabled
    FROM public.system_settings WHERE id = 1;

    IF NOT v_system_enabled THEN
      RETURN jsonb_build_object('success', false, 'error', 'Withdrawal system is currently undergoing maintenance.');
    END IF;

    IF p_amount < v_min_withdrawal THEN
      RETURN jsonb_build_object('success', false, 'error', format('Minimum withdrawal is GHS %.2f', v_min_withdrawal));
    END IF;

    IF p_amount > v_max_withdrawal THEN
      RETURN jsonb_build_object('success', false, 'error', format('Maximum withdrawal is GHS %.2f', v_max_withdrawal));
    END IF;

    -- Calculate lifetime profit
    SELECT COALESCE(SUM(profit), 0) INTO v_total_profit
    FROM public.orders
    WHERE agent_id = p_agent_id AND status = 'fulfilled';

    SELECT v_total_profit + COALESCE(SUM(parent_profit), 0) INTO v_total_profit
    FROM public.orders
    WHERE parent_agent_id = p_agent_id AND status = 'fulfilled';

    -- Total already withdrawn (pending + completed + processing)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn
    FROM public.withdrawals
    WHERE agent_id = p_agent_id AND status IN ('pending', 'completed', 'processing');

    -- Liquid wallet balance
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE agent_id = p_agent_id;

    v_available_to_withdraw := LEAST(v_total_profit - v_total_withdrawn, COALESCE(v_wallet_balance, 0));

    IF p_amount > v_available_to_withdraw THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'available', ROUND(v_available_to_withdraw, 2)
      );
    END IF;

    -- NEW FEE LOGIC: GHS 1.00 flat + 1% percentage
    v_fee        := ROUND(1.00 + (p_amount * 0.01), 2);
    v_net_amount := p_amount - v_fee;

    INSERT INTO public.withdrawals (agent_id, amount, fee, net_amount, status)
    VALUES (p_agent_id, p_amount, v_fee, v_net_amount, v_status)
    RETURNING id INTO v_withdrawal_id;

    IF public.should_auto_approve_withdrawal(v_withdrawal_id) THEN
      UPDATE public.withdrawals
      SET status = 'processing', failure_reason = 'Auto-approved based on system rules'
      WHERE id = v_withdrawal_id;
      v_status := 'processing';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'withdrawal_id', v_withdrawal_id,
      'fee', v_fee,
      'net_amount', v_net_amount,
      'status', v_status
    );
END;
$$;
