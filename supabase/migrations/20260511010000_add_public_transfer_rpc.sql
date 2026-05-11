-- Add a safe RPC allowing authenticated users to move funds from their Main Wallet to their API Wallet.
CREATE OR REPLACE FUNCTION public.user_transfer_to_api(p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_main_balance NUMERIC;
  v_api_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- 1. Atomic update logic: subtract from main, add to api.
  -- Ensures main wallet HAS the funds before proceeding.
  UPDATE public.wallets 
  SET balance = balance - p_amount, 
      api_balance = api_balance + p_amount, 
      updated_at = now()
  WHERE agent_id = v_user_id AND balance >= p_amount
  RETURNING balance, api_balance INTO v_main_balance, v_api_balance;

  IF NOT FOUND THEN
    -- Double check if wallet exists at all
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE agent_id = v_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds in Main Wallet');
    END IF;
  END IF;

  -- 2. Log a ledger record for tracking
  INSERT INTO public.orders (
    agent_id,
    order_type,
    amount,
    cost_price,
    profit,
    status,
    failure_reason
  ) VALUES (
    v_user_id,
    'api_wallet_transfer',
    p_amount,
    p_amount,
    0,
    'fulfilled',
    'Funded from Main Wallet'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'main_balance', v_main_balance, 
    'api_balance', v_api_balance
  );
END;
$$;

-- Grant standard execution to verified authenticated users
REVOKE ALL ON FUNCTION public.user_transfer_to_api(NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_transfer_to_api(NUMERIC) TO authenticated;
