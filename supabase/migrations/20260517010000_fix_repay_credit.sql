-- Migration: Re-create repay_credit and reconcile stuck top-ups
-- Description: Re-creates the repay_credit RPC function natively using the wallets table and reconciles stuck wallet_topup orders.

-- 1. Re-create the repay_credit function with native wallets support
CREATE OR REPLACE FUNCTION public.repay_credit(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSON AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
    END IF;

    -- Add to wallet balance
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    RETURN json_build_object(
        'success', true, 
        'message', 'Wallet credited successfully', 
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Self-healing reconciliation: Find all wallet topup orders stuck in 'processing' or 'paid'
-- since they couldn't run repay_credit, and credit their wallets and mark them as 'fulfilled'!
DO $$
DECLARE
    r RECORD;
    v_credited_count INT := 0;
BEGIN
    FOR r IN 
        SELECT id, agent_id, amount 
        FROM public.orders 
        WHERE order_type = 'wallet_topup' 
          AND status IN ('processing', 'paid') 
          AND created_at >= NOW() - INTERVAL '5 days'
    LOOP
        -- Check if wallet exists
        IF EXISTS (SELECT 1 FROM public.wallets WHERE agent_id = r.agent_id) THEN
            -- Credit the wallet balance
            UPDATE public.wallets 
            SET balance = balance + r.amount,
                updated_at = NOW()
            WHERE agent_id = r.agent_id;

            -- Mark the order as fulfilled
            UPDATE public.orders 
            SET status = 'fulfilled', 
                failure_reason = NULL 
            WHERE id = r.id;

            v_credited_count := v_credited_count + 1;
            RAISE NOTICE 'Reconciled wallet topup order %: credited GHS % to agent %', r.id, r.amount, r.agent_id;
        END IF;
    END LOOP;

    -- Log the self-healing reconciliation to audit logs
    INSERT INTO public.audit_logs (action, details)
    VALUES (
        'wallet_topup_webhook_reconciliation',
        jsonb_build_object(
            'message', format('Reconciled and credited %s stuck wallet topups.', v_credited_count),
            'count', v_credited_count,
            'timestamp', NOW()
        )
    );
END $$;
