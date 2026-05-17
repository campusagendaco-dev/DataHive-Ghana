-- 20260517090000_repair_user_mfa_status_view.sql
-- Repairs user_mfa_status view to run as database owner (SECURITY DEFINER)
-- so authenticated users can verify their MFA status without 403 errors,
-- while securing the data by restricting users to their own UID.

DROP VIEW IF EXISTS public.user_mfa_status CASCADE;

-- Recreate view without security_invoker = true (running as postgres owner)
-- Filter strictly to auth.uid() to ensure user isolation and 100% security.
CREATE OR REPLACE VIEW public.user_mfa_status AS
SELECT 
    user_id, 
    COUNT(*) FILTER (WHERE status = 'verified') > 0 as has_mfa
FROM auth.mfa_factors
WHERE user_id = auth.uid()
GROUP BY user_id;

-- Grant access to authenticated users and service role
GRANT SELECT ON public.user_mfa_status TO authenticated, service_role;
