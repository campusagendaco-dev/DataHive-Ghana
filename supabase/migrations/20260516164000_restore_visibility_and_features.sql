-- Reinforce visibility for parent agents to see their sub-agents and related data

-- 1. Profiles: Allow parent agents to view their sub-agents
DROP POLICY IF EXISTS "Agents can view their sub agents" ON public.profiles;
CREATE POLICY "Agents can view their sub agents" ON public.profiles
  FOR SELECT TO authenticated
  USING (parent_agent_id = auth.uid());

-- 2. Orders: Allow parent agents to view orders made by their sub-agents
DROP POLICY IF EXISTS "Parent agents can view sub agent orders" ON public.orders;
CREATE POLICY "Parent agents can view sub agent orders" ON public.orders
  FOR SELECT TO authenticated
  USING (parent_agent_id = auth.uid());

-- 3. Ensure wallets are visible to parent agents if they need to check sub-agent balances
-- (Optional, but often needed for management)
-- However, sub-agent wallets are usually private. We'll leave it for now unless needed.

-- 4. Ensure notifications and other logs are visible if linked to the agent
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR target_type = 'all');

-- 5. Restore any dropped withdrawal policies
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());
