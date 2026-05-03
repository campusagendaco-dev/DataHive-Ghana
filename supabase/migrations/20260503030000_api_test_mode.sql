-- ADD API TESTING MODE
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS api_test_mode BOOLEAN DEFAULT false;

-- Update API Views
CREATE OR REPLACE VIEW api.v_profiles AS
SELECT 
  user_id,
  full_name,
  api_key_hash,
  api_key_prefix,
  api_secret_key_hash,
  api_access_enabled,
  api_rate_limit,
  api_allowed_actions,
  api_ip_whitelist,
  api_webhook_url,
  api_test_mode,
  is_agent,
  agent_approved,
  sub_agent_approved,
  is_sub_agent,
  parent_agent_id,
  api_custom_prices
FROM public.profiles;

-- Update Authentication RPC
CREATE OR REPLACE FUNCTION api.authenticate_client(p_prefix TEXT, p_hash TEXT)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  secret_key_hash TEXT,
  access_enabled BOOLEAN,
  rate_limit INTEGER,
  allowed_actions TEXT[],
  ip_whitelist TEXT[],
  webhook_url TEXT,
  is_sub_agent BOOLEAN,
  parent_agent_id UUID,
  custom_prices JSONB,
  test_mode BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.api_secret_key_hash,
    p.api_access_enabled,
    p.api_rate_limit::INTEGER,
    p.api_allowed_actions,
    p.api_ip_whitelist,
    p.api_webhook_url,
    p.is_sub_agent,
    p.parent_agent_id,
    p.api_custom_prices,
    p.api_test_mode
  FROM public.profiles p
  WHERE p.api_key_prefix = p_prefix AND p.api_key_hash = p_hash;
END;
$$;

-- Update create_order_rpc to support testing mode
CREATE OR REPLACE FUNCTION api.create_order_rpc(
  p_user_id UUID,
  p_network TEXT,
  p_package_size TEXT,
  p_phone TEXT,
  p_amount NUMERIC,
  p_request_id TEXT,
  p_idem_key TEXT,
  p_test_mode BOOLEAN DEFAULT false
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

  -- 4. Calculate Pricing
  IF v_pkg_row IS NOT NULL THEN
    v_cost_price := COALESCE(v_pkg_row.agent_price, 0); 
    v_final_price := (v_custom_prices->p_network->>p_package_size)::NUMERIC;
    
    IF v_final_price IS NULL OR v_final_price <= 0 THEN
      v_final_price := COALESCE(v_pkg_row.api_price, v_pkg_row.agent_price);
    END IF;
  ELSE
    -- Default/Airtime pricing
    v_final_price := p_amount;
    v_cost_price := p_amount * 0.95; -- Dummy cost
  END IF;

  -- 5. Wallet Check & Debit (SKIP IF TEST MODE)
  IF p_test_mode THEN
    SELECT balance INTO v_wallet_balance FROM public.wallets WHERE agent_id = p_user_id;
    IF v_wallet_balance IS NULL THEN v_wallet_balance := 0; END IF;
  ELSE
    UPDATE public.wallets 
    SET balance = balance - v_final_price,
        updated_at = now()
    WHERE agent_id = p_user_id AND balance >= v_final_price
    RETURNING balance INTO v_wallet_balance;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  END IF;

  -- 6. Create Order
  INSERT INTO public.orders (
    id, agent_id, order_type, customer_phone, network, package_size, 
    amount, profit, status, cost_price, parent_agent_id, parent_profit
  ) VALUES (
    v_order_id, p_user_id, 'api', p_phone, p_network, p_package_size,
    v_final_price, 0, CASE WHEN p_test_mode THEN 'fulfilled' ELSE 'pending' END, v_cost_price, v_parent_agent_id, v_parent_profit
  );

  -- 7. Prepare Response
  v_idem_response := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', CASE WHEN p_test_mode THEN 'fulfilled' ELSE 'pending' END,
    'amount', v_final_price,
    'balance', v_wallet_balance,
    'test_mode', p_test_mode,
    'request_id', p_request_id
  );

  -- 8. Store Idempotency
  INSERT INTO public.idempotency_keys (user_id, key, response_body)
  VALUES (p_user_id, p_idem_key, v_idem_response);

  RETURN v_idem_response;
END;
$$;
