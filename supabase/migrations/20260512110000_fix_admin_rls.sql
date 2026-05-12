-- ============================================================
-- FIX: Admin RLS using SECURITY DEFINER helper
-- The subquery `EXISTS (SELECT 1 FROM user_roles ...)` inside
-- a policy USING clause is blocked by user_roles own RLS.
-- The correct pattern is a SECURITY DEFINER function that
-- runs as the definer (superuser) and bypasses RLS on user_roles.
-- ============================================================

-- Helper: SECURITY DEFINER so it bypasses user_roles RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── system_logs ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_system_logs" ON public.system_logs;
CREATE POLICY "admins_read_system_logs"
  ON public.system_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_system_logs" ON public.system_logs;
CREATE POLICY "admins_update_system_logs"
  ON public.system_logs FOR UPDATE
  USING (public.is_admin());

-- ── feature_flags ────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_feature_flags" ON public.feature_flags;
CREATE POLICY "admins_manage_feature_flags"
  ON public.feature_flags FOR ALL
  USING (public.is_admin());

-- ── sms_templates ────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_sms_templates" ON public.sms_templates;
CREATE POLICY "admins_manage_sms_templates"
  ON public.sms_templates FOR ALL
  USING (public.is_admin());

-- ── blacklisted_phones ───────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_blacklisted_phones" ON public.blacklisted_phones;
CREATE POLICY "admins_manage_blacklisted_phones"
  ON public.blacklisted_phones FOR ALL
  USING (public.is_admin());

-- ── fraud_flags ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_fraud_flags" ON public.fraud_flags;
CREATE POLICY "admins_read_fraud_flags"
  ON public.fraud_flags FOR SELECT
  USING (public.is_admin());

-- ── credit_transactions ──────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_credit_transactions" ON public.credit_transactions;
CREATE POLICY "admins_read_credit_transactions"
  ON public.credit_transactions FOR SELECT
  USING (public.is_admin());
