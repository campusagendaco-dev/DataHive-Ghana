-- API SECURITY HARDENING & ARCHITECTURAL REFACTORING
-- Transition to HMAC signing, strict idempotency, and RPC-based logic.

-- 1. Create API Schema
CREATE SCHEMA IF NOT EXISTS api;

-- 2. Enhance Profiles for Secret Key Storage
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_secret_key_hash TEXT;

-- 3. Create Idempotency Table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_body JSONB NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- Index for cleaning up old keys (e.g., 24h)
CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx ON public.idempotency_keys(created_at);

-- 4. Create Detailed API Logs
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_payload JSONB,
  error_message TEXT,
  stack_trace TEXT,
  log_reference TEXT UNIQUE DEFAULT ('ERR-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 8))),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Views for the API Schema (Firewall)
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
  is_agent,
  agent_approved,
  sub_agent_approved,
  is_sub_agent,
  parent_agent_id,
  api_custom_prices
FROM public.profiles;

CREATE OR REPLACE VIEW api.v_orders AS
SELECT 
  id,
  agent_id,
  customer_phone,
  network,
  package_size,
  amount,
  status,
  failure_reason,
  created_at
FROM public.orders;

CREATE OR REPLACE VIEW api.v_wallets AS
SELECT 
  agent_id,
  balance
FROM public.wallets;

CREATE OR REPLACE VIEW api.v_plans AS
SELECT 
  network,
  package_size,
  agent_price,
  public_price,
  api_price,
  is_unavailable
FROM public.global_package_settings;

-- 6. RPC: Authentication and Profile Fetch
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
  custom_prices JSONB
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
    p.api_custom_prices
  FROM public.profiles p
  WHERE p.api_key_prefix = p_prefix AND p.api_key_hash = p_hash;
END;
$$;

-- 7. RPC: Log Internal Error
CREATE OR REPLACE FUNCTION api.log_internal_error(
  p_user_id UUID,
  p_endpoint TEXT,
  p_method TEXT,
  p_payload JSONB,
  p_error TEXT,
  p_stack TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
BEGIN
  INSERT INTO public.api_logs (user_id, endpoint, method, request_payload, error_message, stack_trace)
  VALUES (p_user_id, p_endpoint, p_method, p_payload, p_error, p_stack)
  RETURNING log_reference INTO v_ref;
  
  RETURN v_ref;
END;
$$;

-- 8. RPC: Secure Atomic Order Creation
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
