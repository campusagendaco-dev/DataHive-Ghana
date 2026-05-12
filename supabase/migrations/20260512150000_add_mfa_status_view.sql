-- Create a view to track MFA status per user by querying internal auth schemas securely
CREATE OR REPLACE VIEW public.user_mfa_status AS
SELECT 
    user_id, 
    COUNT(*) FILTER (WHERE status = 'verified') > 0 as has_mfa
FROM auth.mfa_factors
GROUP BY user_id;

-- Grant access to the view for application logic and administration panels
GRANT SELECT ON public.user_mfa_status TO authenticated;
GRANT SELECT ON public.user_mfa_status TO service_role;
