-- ================================================================
-- BUG FIX: finalize_withdrawal was incorrectly deducting from
-- wallets.balance (the top-up/spending wallet) when completing
-- a withdrawal. Withdrawals come from profit, not from the
-- spending wallet. The withdrawals table already tracks the
-- deduction through status = 'completed', so no wallet debit is needed.
--
-- This also restores wallet balances that went negative because of
-- completed withdrawals that were incorrectly double-debited.
-- ================================================================

-- ── Step 1: Fix the function — remove wallet deduction ───────────
CREATE OR REPLACE FUNCTION public.finalize_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_agent_id UUID;
    v_amount   NUMERIC;
    v_status   TEXT;
    v_new_bal  NUMERIC;
BEGIN
    -- Lock the withdrawal row
    SELECT agent_id, amount, status
    INTO v_agent_id, v_amount, v_status
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
    END IF;

    IF v_status NOT IN ('pending', 'processing') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is already ' || v_status);
    END IF;

    -- NOTE: Do NOT deduct from wallets.balance.
    -- wallets.balance = top-up spending wallet (Paystack deposits).
    -- Withdrawals are profit payouts tracked via the withdrawals table.
    -- Deducting from wallets.balance was causing it to go negative.

    -- Get current wallet balance for return value only
    SELECT balance INTO v_new_bal
    FROM public.wallets
    WHERE agent_id = v_agent_id;

    -- Mark withdrawal completed
    UPDATE public.withdrawals
    SET status = 'completed', completed_at = now()
    WHERE id = p_withdrawal_id;

    -- Audit trail
    INSERT INTO public.orders (agent_id, order_type, amount, profit, status, failure_reason)
    VALUES (v_agent_id, 'withdrawal', v_amount, 0, 'fulfilled', 'Cash withdrawal confirmed')
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('success', true, 'new_balance', COALESCE(v_new_bal, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_withdrawal(UUID) TO service_role;


-- ── Step 2: Restore wallet balances that went negative ───────────
-- Add back amounts incorrectly deducted from wallets.balance for
-- all agents whose wallet went negative due to this bug.
-- We restore by adding back the sum of all completed withdrawals
-- that were debited from their wallet (i.e. wallets with balance < 0).
UPDATE public.wallets w
SET balance = balance + (
    SELECT COALESCE(SUM(wd.amount), 0)
    FROM public.withdrawals wd
    WHERE wd.agent_id = w.agent_id
      AND wd.status = 'completed'
)
WHERE w.balance < 0;
