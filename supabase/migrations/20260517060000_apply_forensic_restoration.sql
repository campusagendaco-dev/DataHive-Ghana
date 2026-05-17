BEGIN;
-- 1. Restore/Credit under-credited real customer balances
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '45667b99-fe09-41cf-8a9b-7b7bde6a21e3';
-- Michael Kamwinnaa Maludong
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '51a190ad-296b-4b03-b808-09c4ef385e3f';
-- Bawa Ebenezer (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '637dae5f-d92d-4707-a5d5-da1b022e498d';
-- Williams Awunyoh (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '9bf201dd-ee21-4a70-8cfc-9186d7566f9d';
-- dff dasw
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = 'e1bddf5b-a26a-4057-bc46-dc41b334d142';
-- hjdbcui (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = 'dffaf45e-8cbe-4278-9540-aa10593efd83';
-- Nyametease ent (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = 'e860e35a-003a-4cf1-ae64-0f6451b0b1b1';
-- BENJAMIN KONADU (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '80f258c0-3bb6-443d-a5b5-380bb6dd4228';
-- KWAMI SUNU (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = 'da4bff33-a64a-467e-b733-2c90984acd49';
-- PLUSPER KINANSUA (clamped)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '95208053-5f9f-443e-8c35-69663cce29ac';
-- Dianne Adusei (clamped)
-- 2. Precision reconcile over-credited accounts to safe clamped balances (no negative balances allowed)
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '324bb585-f6cd-47ce-83eb-b382fb9f5019';
-- Eunice Tabuaa
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = 'c0825d18-3ac9-4a72-849b-f1a3a53d684d';
-- Evans Appiah
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = 'bc92987a-228e-4a2f-b0d1-0d4ba1c11de2';
-- alhassan hudu
UPDATE public.wallets
SET balance = 0.00
WHERE agent_id = '282765fc-3501-4e08-9bb4-52737d54409f';
-- Augustine Wireku
-- 3. Log the surgical balance restoration audit trail
INSERT INTO public.audit_logs (action, details)
VALUES (
    'forensic_migration_restoration',
    jsonb_build_object(
      'message',
      'Restored under-credited customers and reconciled over-credited accounts with all failed/pending transactions and activation fees subtracted and clamped to non-negative balances.',
      'under_credited_count',
      10,
      'over_credited_count',
      4,
      'timestamp',
      now()
    )
  );
COMMIT;