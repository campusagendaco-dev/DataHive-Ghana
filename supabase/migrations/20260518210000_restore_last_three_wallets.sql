-- 20260518210000_restore_last_three_wallets.sql
-- Restores last three wallets with tiny 0.10 discrepancies to be mathematically perfect.

BEGIN;

UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = 'ac2ee4b1-6c43-4090-bd8e-e49fa7a546d9'; -- Unknown User
UPDATE public.wallets SET balance = 1.20, updated_at = now() WHERE agent_id = '59bbf735-7442-49c5-a6d4-cebaac6ea57e'; -- Unknown User
UPDATE public.wallets SET balance = 4.20, updated_at = now() WHERE agent_id = 'b7712f0d-3cc8-457e-b849-b0898b5fb8cd'; -- Adaguna Douglas

INSERT INTO public.audit_logs (action, details)
VALUES (
  'precision_last_three_wallets_restoration',
  to_jsonb('Forensic restoration: Restored last 3 wallets with 0.10 discrepancies.'::text)
);

COMMIT;
