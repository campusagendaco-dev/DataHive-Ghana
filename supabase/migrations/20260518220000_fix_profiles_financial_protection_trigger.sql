-- 20260518220000_fix_profiles_financial_protection_trigger.sql
-- Fixes the fatal crash: "record 'new' has no field 'wallet_balance'".
-- Drops the old invalid trigger ensure_financial_security on public.profiles that referenced non-existent columns.

BEGIN;

-- 1. Drop the trigger that referenced non-existent columns (wallet_balance, loyalty_points, api_balance) on profiles
DROP TRIGGER IF EXISTS ensure_financial_security ON public.profiles;

-- 2. Recreate the trigger function to return NEW directly and securely, avoiding any non-existent column references
CREATE OR REPLACE FUNCTION public.protect_profile_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Financial fields are now fully managed in public.wallets, which is protected by RLS and secure functions.
  -- The profiles table no longer contains wallet_balance, loyalty_points, or api_balance, so we return NEW directly.
  RETURN NEW;
END;
$$;

-- 3. Log this repair in public.audit_logs
INSERT INTO public.audit_logs (action, details)
VALUES (
  'fix_profiles_financial_trigger',
  to_jsonb('Forensic fix: Dropped ensure_financial_security trigger on profiles to resolve record "new" has no field "wallet_balance" crash.'::text)
);

COMMIT;
