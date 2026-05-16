-- Targeted Reconciliation for specific accounts
-- Auditor: Antigravity AI
-- Date: 2026-05-16

DO $$
DECLARE
  _count integer := 0;
BEGIN
  -- 1. appiahevans530@gmail.com (Evans Appiah)
  UPDATE public.wallets SET balance = -2309.17 WHERE agent_id = 'c0825d18-3ac9-4a72-849b-f1a3a53d684d'; _count := _count + 1;
  
  -- 2. tabuaaeunice780@gmail.com (optimist)
  UPDATE public.wallets SET balance = -1699.71 WHERE agent_id = '324bb585-f6cd-47ce-83eb-b382fb9f5019'; _count := _count + 1;
  
  -- 3. hudud2a@gmail.com (alhassan hudu)
  UPDATE public.wallets SET balance = -981.10  WHERE agent_id = 'bc92987a-228e-4a2f-b0d1-0d4ba1c11de2'; _count := _count + 1;
  
  -- 4. Forenawan@gmail.com (Qwaqu)
  UPDATE public.wallets SET balance = -437.28  WHERE agent_id = '282765fc-3501-4e08-9bb4-52737d54409f'; _count := _count + 1;

  -- Log the reconciliation
  INSERT INTO public.audit_logs (action, details)
  VALUES (
    'targeted_wallet_reconciliation',
    jsonb_build_object(
      'message', format('Reconciled %s requested accounts to accurate balances.', _count),
      'accounts', _count,
      'timestamp', now()
    )
  );
END $$;
