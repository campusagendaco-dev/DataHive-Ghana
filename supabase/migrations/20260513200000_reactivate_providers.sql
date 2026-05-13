-- Reactivate all data providers and reset consecutive failures to 0
-- This fixes the "No providers" issue caused by the previous auto-failover bug.

UPDATE public.providers 
SET 
  is_active = true, 
  consecutive_failures = 0, 
  disabled_reason = null 
WHERE provider_type = 'data';
