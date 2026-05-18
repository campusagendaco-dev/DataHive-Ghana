-- 20260518200000_restore_undercredited_wallets.sql
-- Forensic restoration: Synchronizes 25 under-credited wallets with their mathematically perfect,
-- transaction-history-calculated balances (from deposits, purchases, withdrawals, and commissions).

BEGIN;

-- 1. Apply the precision reconciled updates
UPDATE public.wallets SET balance = 8.13, updated_at = now() WHERE agent_id = '49e364b3-2aaf-483b-a1ca-a8a2d68978ed'; -- Naa
UPDATE public.wallets SET balance = 3.10, updated_at = now() WHERE agent_id = '1244e125-8c64-440f-9179-a78cdc9f3101'; -- Bb mens
UPDATE public.wallets SET balance = 1.51, updated_at = now() WHERE agent_id = 'a496e383-48db-4083-9def-3e5d747747d5'; -- Unknown User
UPDATE public.wallets SET balance = 3.26, updated_at = now() WHERE agent_id = '45ed83a8-a938-4047-8b97-36cca33486f4'; -- Unknown User
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = 'aea31680-fcf5-466b-8651-cea64bd0e761'; -- Unknown User
UPDATE public.wallets SET balance = 9.46, updated_at = now() WHERE agent_id = '5c1dae74-d761-4c0c-9712-9ea576697b91'; -- Lydia Esi Duodoo Amoh
UPDATE public.wallets SET balance = 8.61, updated_at = now() WHERE agent_id = '8ae573d9-362c-481a-bb52-8a129e0bec58'; -- Oduro Opoku Solomon
UPDATE public.wallets SET balance = 8.00, updated_at = now() WHERE agent_id = 'ce3d10c5-c788-47c3-b4ae-879b87efec4f'; -- Atiiga Thomas John 
UPDATE public.wallets SET balance = 22.72, updated_at = now() WHERE agent_id = '82e7b016-72bd-4d08-a546-91df7b45a038'; -- Unknown User
UPDATE public.wallets SET balance = 24.24, updated_at = now() WHERE agent_id = '021aafbe-9edb-4ce9-aa02-50d491a89835'; -- Addo Laaseh
UPDATE public.wallets SET balance = 12.26, updated_at = now() WHERE agent_id = '96486fba-8753-4373-bca2-ebd1e1961533'; -- Okyere Emmanuel 
UPDATE public.wallets SET balance = 11.03, updated_at = now() WHERE agent_id = '9439e4fc-20c9-480b-9ac9-2e1e6d72f16b'; -- Unknown User
UPDATE public.wallets SET balance = 33.60, updated_at = now() WHERE agent_id = '72de4d60-23be-4a2f-8adb-ca769b482cbd'; -- Unknown User
UPDATE public.wallets SET balance = 2.41, updated_at = now() WHERE agent_id = 'ef0a94a4-d3c3-42ae-8f4a-2ef471d6ee88'; -- Unknown User
UPDATE public.wallets SET balance = 2.08, updated_at = now() WHERE agent_id = '0f39fe8e-b44b-4ef7-96db-e1ed8161bd93'; -- Mike
UPDATE public.wallets SET balance = 1.53, updated_at = now() WHERE agent_id = 'cade6ebe-681b-4be7-8d89-a1d1f9af3bf7'; -- AJ
UPDATE public.wallets SET balance = 0.70, updated_at = now() WHERE agent_id = '411df1ec-38b4-4626-acbe-304f9b1a71a4'; -- tieku phillips
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = 'cd44da4e-5f84-4e06-bfe7-b172df99da51'; -- PRINCE COFFIE
UPDATE public.wallets SET balance = 2.40, updated_at = now() WHERE agent_id = '1eedc00f-b3d7-4e48-a7ec-dff0d16d0826'; -- Unknown User
UPDATE public.wallets SET balance = 4.30, updated_at = now() WHERE agent_id = '3b34848e-a02d-4c8c-90f9-2aaefeaeb2d7'; -- AMOS BOAKYE DANKWAH
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = 'bc7ee557-359b-413f-8a3f-5c02f4934fb3'; -- Bitcoin 
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = '9586578b-b184-4335-b478-c26eeb062115'; -- Kofi Oberko
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = '656d0948-a0df-4e26-ba8d-94e7ca528d6a'; -- Ishmael zowonu 
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = '0ab4e797-b6fb-4e03-844e-cc7d406b71e0'; -- Unknown User
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = 'a7f0f561-8bf8-4d11-becd-57667acb35a0'; -- Unknown User

-- 2. Log the precision restoration action
INSERT INTO public.audit_logs (action, details)
VALUES (
  'precision_undercredited_wallet_restoration',
  to_jsonb('Forensic restoration: Synchronized 25 under-credited wallets to their exact mathematical transaction balances.'::text)
);

COMMIT;
