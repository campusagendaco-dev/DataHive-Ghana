-- Migration: Add API Wallet and Transfer Mechanism
-- Target: public.wallets, api.v_wallets, api.create_order_rpc

-- 1. Add api_balance to public.wallets
ALTER TABLE public.wallets 
  ADD COLUMN IF NOT EXISTS api_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- 2. Update api.v_wallets view
CREATE OR REPLACE VIEW api.v_wallets AS
SELECT 
  agent_id,
  balance,
  api_balance
FROM public.wallets;

-- 3. Create Transfer RPC
CREATE OR REPLACE FUNCTION api.transfer_funds(
  p_user_id UUID,
  p_amount NUMERIC,
  p_from TEXT,
  p_to TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
DECLARE
  v_main_balance NUMERIC;
  v_api_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_from = 'main' AND p_to = 'api' THEN
    UPDATE public.wallets 
    SET balance = balance - p_amount,
        api_balance = api_balance + p_amount,
        updated_at = now()
    WHERE agent_id = p_user_id AND balance >= p_amount
    RETURNING balance, api_balance INTO v_main_balance, v_api_balance;
  ELSIF p_from = 'api' AND p_to = 'main' THEN
    UPDATE public.wallets 
    SET api_balance = api_balance - p_amount,
        balance = balance + p_amount,
        updated_at = now()
    WHERE agent_id = p_user_id AND api_balance >= p_amount
    RETURNING balance, api_balance INTO v_main_balance, v_api_balance;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid transfer direction. Use "main" and "api".');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds or wallet not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'main_balance', v_main_balance,
    'api_balance', v_api_balance
  );
END;
$$;

-- 4. Update api.create_order_rpc to use api_balance
CREATE OR REPLACE FUNCTION api.create_order_rpc(
  p_user_id UUID,
  p_network TEXT,
  p_package_size TEXT,
  p_phone TEXT,
  p_amount NUMERIC,
  p_request_id TEXT,
  p_idem_key TEXT,
  p_test_mode BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_cost_price NUMERIC;
  v_final_price NUMERIC;
  v_parent_agent_id UUID;
  v_parent_profit NUMERIC := 0;
  v_order_id UUID := gen_random_uuid();
  v_custom_prices JSONB;
  v_is_sub_agent BOOLEAN;
  v_pkg_row RECORD;
  v_idem_response JSONB;
BEGIN
  -- 1. Check Idempotency
  SELECT response_body INTO v_idem_response 
  FROM public.idempotency_keys 
  WHERE user_id = p_user_id AND key = p_idem_key;
  
  IF v_idem_response IS NOT NULL THEN
    RETURN v_idem_response || jsonb_build_object('idempotent_replayed', true);
  END IF;

  -- 2. Get Profile Info
  SELECT api_custom_prices, is_sub_agent, parent_agent_id INTO v_custom_prices, v_is_sub_agent, v_parent_agent_id
  FROM public.profiles WHERE user_id = p_user_id;

  -- 3. Get Package Info
  SELECT * INTO v_pkg_row 
  FROM public.global_package_settings 
  WHERE network = p_network AND package_size = p_package_size;

  IF v_pkg_row IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;
  
  IF v_pkg_row.is_unavailable THEN
    RAISE EXCEPTION 'Package is currently unavailable';
  END IF;

  -- 4. Calculate Pricing
  v_cost_price := COALESCE(v_pkg_row.agent_price, 0); 
  
  -- Check for custom price override
  v_final_price := (v_custom_prices->p_network->>p_package_size)::NUMERIC;
  
  IF v_final_price IS NULL OR v_final_price <= 0 THEN
    IF v_is_sub_agent AND v_parent_agent_id IS NOT NULL THEN
      -- Sub-agent pricing from parent
      DECLARE
        v_parent_prices JSONB;
      BEGIN
        SELECT api_custom_prices INTO v_parent_prices FROM public.profiles WHERE user_id = v_parent_agent_id;
        v_final_price := (v_parent_prices->p_network->>p_package_size)::NUMERIC;
        
        IF v_final_price IS NULL OR v_final_price <= 0 THEN
          v_final_price := COALESCE(v_pkg_row.api_price, v_pkg_row.agent_price);
        END IF;
        
        -- Parent profit
        v_parent_profit := GREATEST(0, v_final_price - v_pkg_row.agent_price);
      END;
    ELSE
      v_final_price := COALESCE(v_pkg_row.api_price, v_pkg_row.agent_price);
    END IF;
  END IF;

  IF v_final_price IS NULL OR v_final_price <= 0 THEN
    RAISE EXCEPTION 'Pricing could not be determined';
  END IF;

  -- 5. Wallet Check & Debit (USING api_balance)
  IF p_test_mode THEN
    v_wallet_balance := 999; -- Dummy balance for test mode
  ELSE
    UPDATE public.wallets 
    SET api_balance = api_balance - v_final_price,
        updated_at = now()
    WHERE agent_id = p_user_id AND api_balance >= v_final_price
    RETURNING api_balance INTO v_wallet_balance;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient API balance. Please fund your API wallet.';
    END IF;
  END IF;

  -- 6. Create Order
  INSERT INTO public.orders (
    id, agent_id, order_type, customer_phone, network, package_size, 
    amount, profit, status, cost_price, parent_agent_id, parent_profit
  ) VALUES (
    v_order_id, p_user_id, 'api', p_phone, p_network, p_package_size,
    v_final_price, 0, 'fulfilled', v_cost_price, v_parent_agent_id, v_parent_profit
  );

  -- 7. Prepare Response
  v_idem_response := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', 'fulfilled',
    'amount', v_final_price,
    'balance', v_wallet_balance,
    'request_id', p_request_id
  );

  -- 8. Store Idempotency
  INSERT INTO public.idempotency_keys (user_id, key, response_body)
  VALUES (p_user_id, p_idem_key, v_idem_response);

  RETURN v_idem_response;
END;
$$;

-- 5. Create Credit API Wallet RPC
CREATE OR REPLACE FUNCTION api.credit_api_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE public.wallets 
  SET api_balance = api_balance + p_amount,
      updated_at = now()
  WHERE agent_id = p_user_id
  RETURNING api_balance INTO v_new_balance;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (agent_id, api_balance, updated_at)
    VALUES (p_user_id, p_amount, now())
    RETURNING api_balance INTO v_new_balance;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
