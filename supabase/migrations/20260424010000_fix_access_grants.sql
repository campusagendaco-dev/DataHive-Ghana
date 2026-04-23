-- FIX: Restore table-level SELECT grants broken by the security hardening migration.
--
-- Root cause:
--   20260423155000_security_hardening revoked table-level SELECT on system_settings
--   from anon/authenticated and replaced with column-level grants.
--   PostgREST treats tables with no table-level privilege as invisible, returning HTTP 401.
--   This broke Footer, FreeDataButton, and FreeDataClaimBanner (all public components
--   that query system_settings directly as anon users).
--
--   The same migration also revoked SELECT on profiles from anon,
--   and 20260423160000_cyber_security_reinforcement revoked it from authenticated too.
--   This broke admin pages that select columns not in the restricted column-level grant
--   (e.g. agent_prices, markups, disabled_packages, is_sub_agent, parent_agent_id, etc.)
--
-- Fix:
--   Restore table-level SELECT grants. Row-level security (RLS) already enforces which
--   rows each role can access — column-level revokes are not needed and break functionality.

-- 1. Restore system_settings access for anon and authenticated
--    (public-facing components need this: Footer, FreeDataButton, FreeDataClaimBanner)
GRANT SELECT ON public.system_settings TO anon, authenticated;

-- 2. Restore profiles access for authenticated
--    (admin pages need full column access; RLS ensures users only see their own row,
--     admins see all rows via the "Admins can view all profiles" policy)
GRANT SELECT ON public.profiles TO authenticated;

-- Note: The anon column-level grant on profiles is intentionally left in place.
--       Anon users can only see a limited set of profile columns (store_name, slug,
--       whatsapp_number, etc.) and only for approved agent profiles (via RLS).
--       This is a reasonable restriction for public agent store pages.
