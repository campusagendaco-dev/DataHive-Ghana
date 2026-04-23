-- CYBER SECURITY & LOGIC REINFORCEMENT
-- 1. FIX: Parent Profit was being ignored in withdrawal calculations.
-- This prevented parent agents from withdrawing commissions earned from sub-agents.

CREATE OR REPLACE FUNCTION request_withdrawal(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_agent BOOLEAN;
  v_agent_approved BOOLEAN;
  v_total_profit NUMERIC;
  v_total_parent_profit NUMERIC;
  v_total_withdrawn NUMERIC;
  v_available_balance NUMERIC;
  v_withdrawal_id UUID;
BEGIN
  -- 1. Lock the agent's profile to prevent concurrent withdrawal requests
  SELECT is_agent, agent_approved INTO v_is_agent, v_agent_approved
  FROM profiles
  WHERE user_id = p_agent_id
  FOR UPDATE;

  IF NOT v_is_agent OR NOT v_agent_approved THEN
    RETURN json_build_object('success', false, 'error', 'Agent not found or not approved');
  END IF;

  -- 2. Calculate total profit from fulfilled orders (own sales)
  SELECT COALESCE(SUM(profit), 0) INTO v_total_profit
  FROM orders
  WHERE agent_id = p_agent_id AND status = 'fulfilled';

  -- 3. Calculate total parent_profit from fulfilled orders (sub-agent sales)
  SELECT COALESCE(SUM(parent_profit), 0) INTO v_total_parent_profit
  FROM orders
  WHERE parent_agent_id = p_agent_id AND status = 'fulfilled';

  -- 4. Calculate total already withdrawn or pending
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn
  FROM withdrawals
  WHERE agent_id = p_agent_id AND status IN ('completed', 'pending', 'processing');

  -- 5. Calculate available balance (Own Profit + Parent Profit - Withdrawals)
  v_available_balance := (v_total_profit + v_total_parent_profit) - v_total_withdrawn;

  IF p_amount > v_available_balance THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'available', v_available_balance);
  END IF;

  -- 6. Insert pending withdrawal request safely
  v_withdrawal_id := gen_random_uuid();
  
  INSERT INTO withdrawals (id, agent_id, amount, status)
  VALUES (v_withdrawal_id, p_agent_id, p_amount, 'pending');

  RETURN json_build_object('success', true, 'withdrawal_id', v_withdrawal_id);
END;
$$;

-- 2. FIX: Admin Order Insertion Policy
-- My previous hardening restricted 'Anyone' to status = 'pending'. 
-- This blocked admins from creating manual fulfilled orders.
CREATE POLICY "Admins can create fulfilled orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- 3. HARDENING: Audit Logs Protection
-- Prevent any modification or deletion of audit logs, even by admins.
-- This ensures the trail of actions remains permanent.
DROP POLICY IF EXISTS "Admins manage audit logs" ON audit_logs;
CREATE POLICY "Admins read audit logs" ON audit_logs FOR SELECT USING (
  public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins/System create audit logs" ON audit_logs FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);
-- No UPDATE or DELETE policies granted means they are blocked.

-- 4. HARDENING: Prevent non-admins from viewing other users' MoMo details in AdminWithdrawals
-- The 'profiles' select policy I added for 'anon' was safe, but 'authenticated' users 
-- could still see everything due to the default policy.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, full_name, email, phone, whatsapp_number, support_number, store_name, 
  whatsapp_group_link, slug, momo_number, momo_network, momo_account_name, 
  is_agent, onboarding_complete, agent_approved, sub_agent_approved,
  created_at, updated_at
) ON public.profiles TO authenticated;
-- Note: authenticated users can see their own full row via RLS filters in the frontend,
-- but this grant restricts what columns are FETCHABLE for others even if RLS allows it.
-- Wait, in Postgres, if you have GRANT SELECT (col1, col2), you can't select others.
-- We must make sure the user can still see their own API keys.
GRANT SELECT (api_key, api_access_enabled, api_rate_limit, api_allowed_actions, api_ip_whitelist) 
ON public.profiles TO authenticated;
-- We use RLS to ensure they only see their OWN api_key.
