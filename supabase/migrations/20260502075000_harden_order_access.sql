-- SECURITY HARDENING: Restrict sensitive data exposure in orders for anonymous users.
-- Revokes full table access and grants only non-sensitive columns to the 'anon' role.

REVOKE SELECT ON public.orders FROM anon;
GRANT SELECT (
  id, 
  status, 
  network, 
  package_size, 
  amount, 
  created_at, 
  failure_reason, 
  utility_type, 
  utility_provider,
  utility_account_name
) ON public.orders TO anon;

-- Note: customer_phone, agent_id, profit, and parent_profit are now hidden from anonymous lookups.
-- This prevents data scraping of customer phone numbers by guessing order UUIDs.
