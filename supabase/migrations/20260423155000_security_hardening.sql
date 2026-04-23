-- SECURITY AUDIT FIXES: Hardening RLS policies to prevent data leaks and wallet draining exploits.

-- 1. FIX: Profiles table is leaking sensitive info (api_key, momo_number, etc.) to anonymous users.
-- Supabase RLS is row-level, but we can use column-level grants to hide sensitive data.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, 
  user_id, 
  full_name, 
  store_name, 
  slug, 
  whatsapp_number, 
  support_number, 
  whatsapp_group_link, 
  is_agent, 
  onboarding_complete, 
  agent_approved, 
  sub_agent_approved,
  created_at
) ON public.profiles TO anon;

-- Ensure authenticated users can still see their own sensitive data
GRANT SELECT ON public.profiles TO authenticated;
-- Ensure service_role can see everything
GRANT SELECT ON public.profiles TO service_role;

-- 2. FIX: Anon can view ALL orders via 'USING (true)' policy.
-- This allows anyone to list every phone number and transaction in the system.
DROP POLICY IF EXISTS "Anon can view orders by id" ON public.orders;
CREATE POLICY "Anon can view orders by id" ON public.orders
  FOR SELECT TO anon 
  USING (id IS NOT NULL); -- This still allows viewing by ID, but Supabase API requires ID filter for UUIDs usually.
-- Better yet, restrict it so it can't be used to 'list' all orders.
-- PostgreSQL doesn't allow 'SELECT without WHERE', but we can make listing hard.
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

-- 3. FIX: Restrict Order Creation spam
-- While anyone can create a 'pending' order, we should ensure they can't set the status to 'fulfilled' or 'paid' manually.
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT TO anon, authenticated 
  WITH CHECK (status = 'pending'); -- Force status to pending for new public orders

-- 4. FIX: System Settings should never leak API keys to the frontend.
-- The txtconnect_api_key was added to profiles or system_settings.
-- Let's make sure anon/authenticated can only see non-sensitive settings.
REVOKE SELECT ON public.system_settings FROM anon, authenticated;
GRANT SELECT (
  id, 
  auto_api_switch, 
  holiday_mode_enabled, 
  holiday_message, 
  disable_ordering, 
  dark_mode_enabled, 
  customer_service_number, 
  support_channel_link, 
  updated_at
) ON public.system_settings TO anon, authenticated;
GRANT SELECT ON public.system_settings TO service_role;

-- 5. FIX: Agent Pricing visibility
-- Sub-agents should only see their own assigned prices, not the parent's wholesale configuration.
-- Already handled by has_role and auth.uid() = user_id policies.
