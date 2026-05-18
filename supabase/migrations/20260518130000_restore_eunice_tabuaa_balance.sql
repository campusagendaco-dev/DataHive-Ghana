-- 20260518130000_restore_eunice_tabuaa_balance.sql
-- Restores Eunice Tabuaa's wallet balance back to its executive-established GHS 58.80 balance,
-- reversing the negative drift from the duplicated restoration deduction.

BEGIN;

UPDATE public.wallets 
SET balance = 58.80, updated_at = now() 
WHERE agent_id = '324bb585-f6cd-47ce-83eb-b382fb9f5019';

INSERT INTO public.audit_logs (action, details, target_id) 
VALUES (
  'balance_correction', 
  to_jsonb('System correction: Restored Eunice Tabuaa balance back to GHS 58.80 to resolve negative deduction drift'::text), 
  '324bb585-f6cd-47ce-83eb-b382fb9f5019'
);

COMMIT;
