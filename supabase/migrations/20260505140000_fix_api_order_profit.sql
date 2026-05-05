-- FIX: API Order Profit Calculation
-- This migration corrects the profit calculation in api.create_order_rpc and api.create_order_rpc_v2 (if exists)
-- to ensure that the platform's profit is correctly recorded.

CREATE OR REPLACE FUNCTION api.create_order_rpc(
  p_user_id UUID,
  p_network TEXT,
  p_package_size TEXT,
  p_phone TEXT,
  p_amount NUMERIC,
  p_request_id TEXT,
  p_idem_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_cost_price NUMERIC;
  v_agent_price NUMERIC;
  v_final_price NUMERIC;
  v_parent_agent_id UUID;
  v_parent_profit NUMERIC := 0;
  v_order_id UUID := gen_random_uuid();
  v_custom_prices JSONB;
  v_is_sub_agent BOOLEAN;
  v_pkg_row RECORD;
  v_idem_response JSONB;
  v_admin_profit NUMERIC;
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
  -- Acquisition cost for the platform
  v_cost_price := COALESCE(v_pkg_row.cost_price, v_pkg_row.agent_price, 0); 
  
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
        
        -- Parent profit (difference between sub-agent price and parent's wholesale price)
        v_parent_profit := GREATEST(0, v_final_price - v_pkg_row.agent_price);
      END;
    ELSE
      v_final_price := COALESCE(v_pkg_row.api_price, v_pkg_row.agent_price);
    END IF;
  END IF;

  IF v_final_price IS NULL OR v_final_price <= 0 THEN
    RAISE EXCEPTION 'Pricing could not be determined';
  END IF;

  -- Calculate Admin Profit: What we charge the user - what we pay provider - what we give parent
  v_admin_profit := GREATEST(0, v_final_price - v_cost_price - v_parent_profit);

  -- 5. Wallet Check & Debit
  UPDATE public.wallets 
  SET balance = balance - v_final_price,
      updated_at = now()
  WHERE agent_id = p_user_id AND balance >= v_final_price
  RETURNING balance INTO v_wallet_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 6. Create Order
  INSERT INTO public.orders (
    id, agent_id, order_type, customer_phone, network, package_size, 
    amount, profit, status, cost_price, parent_agent_id, parent_profit
  ) VALUES (
    v_order_id, p_user_id, 'api', p_phone, p_network, p_package_size,
    v_final_price, v_admin_profit, 'fulfilled', v_cost_price, v_parent_agent_id, v_parent_profit
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
