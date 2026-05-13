-- CRITICAL SECURITY HARDENING & DOS MITIGATION
-- 1. Creates a generic rate limiting table and RPC for public edge functions.
-- 2. Recreates debit_wallet and credit_wallet with rigid protection against negative value exploits.

-- ════════════════════════════════════════════════════════════
-- 1. GENERIC RATE LIMITING TIER
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.generic_rate_limit_counters (
  key           TEXT        PRIMARY KEY,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER     NOT NULL DEFAULT 1,
  CONSTRAINT positive_count CHECK (request_count >= 0)
);

-- Revoke direct client access and grant explicitly to service_role
ALTER TABLE public.generic_rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generic_rate_limit_counters FROM anon, authenticated;
GRANT ALL ON public.generic_rate_limit_counters TO service_role;

CREATE OR REPLACE FUNCTION public.check_generic_rate_limit(
  p_key        TEXT,
  p_rate_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_now   TIMESTAMPTZ := NOW();
BEGIN
  -- Atomically increment count or reset window if minute passed
  INSERT INTO public.generic_rate_limit_counters (key, window_start, request_count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE
    SET
      request_count = CASE
        WHEN public.generic_rate_limit_counters.window_start < v_now - INTERVAL '1 minute'
        THEN 1
        ELSE public.generic_rate_limit_counters.request_count + 1
      END,
      window_start = CASE
        WHEN public.generic_rate_limit_counters.window_start < v_now - INTERVAL '1 minute'
        THEN v_now
        ELSE public.generic_rate_limit_counters.window_start
      END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_rate_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_generic_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_generic_rate_limit TO service_role;

-- ════════════════════════════════════════════════════════════
-- 2. HARDEN DEBIT WALLET RPC
-- ════════════════════════════════════════════════════════════

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

    -- Enforce credit limit (overdraft bound)
    IF (current_balance - p_amount) < (-current_limit) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Insufficient balance',
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
        'new_balance', (current_balance - p_amount)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet TO service_role;

-- ════════════════════════════════════════════════════════════
-- 3. HARDEN CREDIT WALLET RPC
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.credit_wallet(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Block negative injections
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Lock row for update
  SELECT balance INTO v_balance
  FROM wallets
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  -- Initialize wallet if not present
  IF v_balance IS NULL THEN
    INSERT INTO wallets (agent_id, balance, updated_at)
    VALUES (p_agent_id, p_amount, now());
    RETURN json_build_object('success', true, 'new_balance', p_amount);
  END IF;

  v_new_balance := ROUND(v_balance + p_amount, 2);

  UPDATE wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE agent_id = p_agent_id;

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet TO service_role;
