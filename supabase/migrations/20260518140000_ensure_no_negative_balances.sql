-- 20260518140000_ensure_no_negative_balances.sql
-- Restores all debt-protected users to their established positive balances and
-- clamps any remaining negative wallet balances to 0.00 (ensuring no negative balance on the platform).

BEGIN;

-- 1. Restore the specific executive-established positive balances
UPDATE public.wallets SET balance = 87.50, updated_at = now() WHERE agent_id = '282765fc-3501-4e08-9bb4-52737d54409f'; -- AUGUSTINE WIREKU
UPDATE public.wallets SET balance = 45.00, updated_at = now() WHERE agent_id = 'bc92987a-228e-4a2f-b0d1-0d4ba1c11de2'; -- alhassan hudu
UPDATE public.wallets SET balance = 23.20, updated_at = now() WHERE agent_id = '637dae5f-d92d-4707-a5d5-da1b022e498d'; -- Williams Awunyoh
UPDATE public.wallets SET balance = 501.00, updated_at = now() WHERE agent_id = 'e1bddf5b-a26a-4057-bc46-dc41b334d142'; -- dff dasw
UPDATE public.wallets SET balance = 497.47, updated_at = now() WHERE agent_id = 'dffaf45e-8cbe-4278-9540-aa10593efd83'; -- hjdbcui
UPDATE public.wallets SET balance = 20.00, updated_at = now() WHERE agent_id = 'e860e35a-003a-4cf1-ae64-0f6451b0b1b1'; -- BENJAMIN KONADU
UPDATE public.wallets SET balance = 4.40, updated_at = now() WHERE agent_id = '95208053-5f9f-443e-8c35-69663cce29ac'; -- Dianne Adusei

-- 2. Clamp any other negative balances to 0.00
UPDATE public.wallets SET balance = 0.00, updated_at = now() WHERE balance < 0;

-- 3. Log the system-wide correction
INSERT INTO public.audit_logs (action, details)
VALUES (
  'global_no_negative_balance_enforcement',
  to_jsonb('System-wide correction: Restored established positive balances and clamped all remaining negative wallets to 0.00'::text)
);

COMMIT;
