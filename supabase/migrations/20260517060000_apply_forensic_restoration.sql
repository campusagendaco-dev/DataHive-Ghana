BEGIN;

-- 1. Restore/Credit under-credited real customer balances
UPDATE public.wallets SET balance = 4580.88 WHERE agent_id = '45667b99-fe09-41cf-8a9b-7b7bde6a21e3'; -- Michael Kamwinnaa Maludong
UPDATE public.wallets SET balance = 1221.80 WHERE agent_id = 'e5d9da29-e10b-44dd-a13c-8c12a5e65c1c'; -- Bawa Ebenezer
UPDATE public.wallets SET balance = 517.60  WHERE agent_id = '89434f65-1f44-438f-be3a-26eae7122b3f'; -- Williams Awunyoh
UPDATE public.wallets SET balance = 501.00  WHERE agent_id = '9bf201dd-ee21-4a70-8cfc-9186d7566f9d'; -- dff dasw
UPDATE public.wallets SET balance = 497.47  WHERE agent_id = 'dac42fe3-4152-4fd3-b440-5e957eb8bd88'; -- hjdbcui
UPDATE public.wallets SET balance = 388.46  WHERE agent_id = 'e85ce5e1-117b-4830-b475-fb9dc2bd9ea9'; -- Nyametease ent
UPDATE public.wallets SET balance = 349.60  WHERE agent_id = 'e8344413-7fdd-4d6b-91d8-c42f55cfd648'; -- BENJAMIN KONADU
UPDATE public.wallets SET balance = 329.60  WHERE agent_id = 'a721223f-7253-4bbf-90bf-7bb5e7cb7b20'; -- KWAMI SUNU
UPDATE public.wallets SET balance = 329.60  WHERE agent_id = 'a258fec5-e375-4d8a-be9e-c46ef3d121ad'; -- PLUSPER KINANSUA
UPDATE public.wallets SET balance = 261.90  WHERE agent_id = 'dc152ad7-1b5d-4315-ba1a-e3c79f18bceb'; -- Dianne Adusei

-- 2. Precision reconcile over-credited accounts to mathematical debt
UPDATE public.wallets SET balance = -3368.82 WHERE agent_id = '324bb585-f6cd-47ce-83eb-b382fb9f5019'; -- Eunice Tabuaa
UPDATE public.wallets SET balance = -2725.87 WHERE agent_id = 'c0825d18-3ac9-4a72-849b-f1a3a53d684d'; -- Evans Appiah
UPDATE public.wallets SET balance = -981.10  WHERE agent_id = 'bc92987a-228e-4a2f-b0d1-0d4ba1c11de2'; -- alhassan hudu
UPDATE public.wallets SET balance = -546.08  WHERE agent_id = '282765fc-3501-4e08-9bb4-52737d54409f'; -- Augustine Wireku

-- 3. Log the surgical balance restoration audit trail
INSERT INTO public.audit_logs (action, details)
VALUES (
  'forensic_migration_restoration',
  jsonb_build_object(
    'message', 'Restored 10 under-credited customers and reconciled 4 over-credited accounts.',
    'under_credited_count', 10,
    'over_credited_count', 4,
    'timestamp', now()
  )
);

COMMIT;
