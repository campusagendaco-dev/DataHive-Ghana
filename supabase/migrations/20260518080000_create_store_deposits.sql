-- 20260518080000_create_store_deposits.sql
-- Creates the store_deposits table and approve_store_deposit RPC function

-- 1. Create the store_deposits table
CREATE TABLE IF NOT EXISTS public.store_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  sender_number TEXT,
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amount_positive CHECK (amount > 0)
);

-- 2. Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_store_deposits_agent_id ON public.store_deposits(agent_id);
CREATE INDEX IF NOT EXISTS idx_store_deposits_customer_id ON public.store_deposits(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_deposits_status ON public.store_deposits(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.store_deposits ENABLE ROW LEVEL SECURITY;

-- 4. Set up RLS Policies
DROP POLICY IF EXISTS "Allow select for customer and agent" ON public.store_deposits;
CREATE POLICY "Allow select for customer and agent" ON public.store_deposits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = agent_id);

DROP POLICY IF EXISTS "Allow customer to insert deposits" ON public.store_deposits;
CREATE POLICY "Allow customer to insert deposits" ON public.store_deposits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Allow agent to update deposits" ON public.store_deposits;
CREATE POLICY "Allow agent to update deposits" ON public.store_deposits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

-- 5. Create the approve_store_deposit RPC function
CREATE OR REPLACE FUNCTION public.approve_store_deposit(deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit RECORD;
  v_agent_balance NUMERIC;
BEGIN
  -- 1. Fetch deposit with a lock to prevent race conditions
  SELECT * INTO v_deposit FROM public.store_deposits WHERE id = deposit_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit request not found.');
  END IF;

  -- 2. Check status
  IF v_deposit.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This deposit request has already been processed.');
  END IF;

  -- 3. Authorization check (only the agent who owns the storefront can approve it)
  -- Since SECURITY DEFINER runs as owner, auth.uid() represents the logged-in caller.
  IF auth.uid() != v_deposit.agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  -- 4. Fetch agent's balance with a lock
  SELECT balance INTO v_agent_balance FROM public.wallets WHERE agent_id = v_deposit.agent_id FOR UPDATE;
  
  IF v_agent_balance < v_deposit.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance in your agent wallet to approve this deposit.');
  END IF;

  -- 5. Deduct from agent
  UPDATE public.wallets 
  SET balance = balance - v_deposit.amount 
  WHERE agent_id = v_deposit.agent_id;

  -- 6. Credit to customer (ensuring customer has a wallet row)
  INSERT INTO public.wallets (agent_id, balance)
  VALUES (v_deposit.customer_id, v_deposit.amount)
  ON CONFLICT (agent_id) 
  DO UPDATE SET balance = public.wallets.balance + v_deposit.amount;

  -- 7. Update deposit status
  UPDATE public.store_deposits 
  SET status = 'approved', updated_at = NOW() 
  WHERE id = deposit_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_store_deposit(UUID) TO authenticated;

-- 7. Restore public.audit_logs.details to JSONB type
-- This converts any raw text values written by historical migrations into valid JSON string representations.
ALTER TABLE public.audit_logs ALTER COLUMN details TYPE JSONB USING to_jsonb(details);
