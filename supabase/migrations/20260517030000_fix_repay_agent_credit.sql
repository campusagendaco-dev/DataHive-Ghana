-- ════════════════════════════════════════════════════════════
-- CRITICAL FIX: REDEFINE repay_agent_credit FOR NATIVE WALLETS
-- ════════════════════════════════════════════════════════════
-- Explanation: The admin manual repayment flow (via AdminCreditManagement)
-- previously updated profiles.credit_used, which had no effect on the 
-- agent's actual wallets.balance. This script aligns the manual repayment 
-- RPC to atomically credit wallets.balance.

CREATE OR REPLACE FUNCTION public.repay_agent_credit(
  p_agent_id uuid,
  p_amount   numeric,
  p_note     text DEFAULT 'Manual repayment'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used numeric;
  v_balance numeric;
BEGIN
  -- 1. Get exclusive lock on native wallet
  SELECT balance INTO v_balance FROM public.wallets WHERE agent_id = p_agent_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- 2. Repay the credit by crediting the native wallet balance
  UPDATE public.wallets
    SET balance = balance + p_amount, updated_at = now()
  WHERE agent_id = p_agent_id;

  -- 3. Sync legacy profiles.credit_used dynamically
  SELECT CASE WHEN balance < 0 THEN -balance ELSE 0 END INTO v_used 
  FROM public.wallets WHERE agent_id = p_agent_id;

  UPDATE public.profiles
    SET credit_used = v_used, updated_at = now()
  WHERE user_id = p_agent_id;

  -- 4. Audit trail
  INSERT INTO public.credit_transactions (agent_id, type, amount, balance_after, note)
  VALUES (p_agent_id, 'repay', p_amount, v_used, p_note);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repay_agent_credit(uuid, numeric, text) TO authenticated;
