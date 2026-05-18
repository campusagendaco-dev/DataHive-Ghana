-- CRITICAL SECURITY HARDENING: Protect financial fields on profiles table
-- This migration ensures that non-admins cannot update their own wallet_balance or loyalty_points.

-- Ensure audit_logs has the target_id column
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id UUID;

-- Temporarily change details type to TEXT so that older restoration scripts writing raw text strings do not fail
ALTER TABLE public.audit_logs ALTER COLUMN details TYPE TEXT USING details::text;

CREATE OR REPLACE FUNCTION public.protect_profile_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user is an admin OR it's the service role, let them change anything.
  IF public.has_role(auth.uid(), 'admin') OR (current_setting('role') = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- For non-admins, if they try to change any of these financial fields, ignore the change (keep OLD value).
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    NEW.wallet_balance := OLD.wallet_balance;
  END IF;

  IF NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points THEN
    NEW.loyalty_points := OLD.loyalty_points;
  END IF;

  -- Also protect the api_balance
  IF NEW.api_balance IS DISTINCT FROM OLD.api_balance THEN
    NEW.api_balance := OLD.api_balance;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply the financial protection trigger
DROP TRIGGER IF EXISTS ensure_financial_security ON public.profiles;
CREATE TRIGGER ensure_financial_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_financial_fields();

-- Log the security reinforcement
INSERT INTO public.audit_logs (action, details, target_id)
VALUES ('security_hardening', '{"message": "Reinforced financial field protection for profiles table (wallet_balance, loyalty_points, api_balance)"}'::jsonb, auth.uid());
