-- 20260518160000_robust_auto_refunds_and_stuck_orders.sql
-- 1. Redefines public.refund_failed_order to treat NULL payment methods as 'wallet' to support all legacy/webhook transactions.
-- 2. Modifies auto_reset_stuck_orders to transition stuck processing orders to 'fulfillment_failed' immediately.
-- 3. Force-processes the 10 currently stuck processing orders, setting them to 'fulfillment_failed' and triggering their refunds.

BEGIN;

-- 1. Redefine refund_failed_order to allow NULL as 'wallet'
CREATE OR REPLACE FUNCTION public.refund_failed_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order  public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_order.auto_refunded THEN RETURN false; END IF;  -- idempotent
  IF COALESCE(v_order.payment_method, 'wallet') NOT IN ('wallet', 'balance') THEN RETURN false; END IF;
  IF v_order.amount <= 0 THEN RETURN false; END IF;

  -- Refund wallet
  PERFORM public.credit_wallet(p_agent_id := v_order.agent_id, p_amount := v_order.amount);

  -- Mark order as refunded
  UPDATE public.orders SET
    auto_refunded  = true,
    refunded_at    = now(),
    refund_amount  = v_order.amount,
    refund_reason  = 'Auto-refund: order fulfillment failed',
    updated_at     = now()
  WHERE id = p_order_id;

  -- Log it
  INSERT INTO public.system_logs (level, source, event, message, order_id, agent_id, data)
  VALUES (
    'info', 'system', 'order.refunded',
    format('Auto-refund GHS %s for failed order', v_order.amount),
    p_order_id, v_order.agent_id,
    jsonb_build_object('amount', v_order.amount, 'network', v_order.network, 'package_size', v_order.package_size)
  );

  -- Notify agent
  INSERT INTO public.user_notifications (user_id, title, message, type, data)
  VALUES (
    v_order.agent_id,
    'Order Refunded',
    format('GHS %s has been refunded to your wallet. Order for %s %s could not be fulfilled.',
      v_order.amount, v_order.network, v_order.package_size),
    'info',
    jsonb_build_object('order_id', p_order_id, 'amount', v_order.amount)
  )
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

-- 2. Redefine auto_reset_stuck_orders to transition stuck processing orders to 'fulfillment_failed'
CREATE OR REPLACE FUNCTION public.auto_reset_stuck_orders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  -- Update stuck processing orders to 'fulfillment_failed' to trigger auto-refund
  UPDATE public.orders
  SET
    status        = 'fulfillment_failed',
    failure_reason = 'Auto-reset: stuck in processing without provider submission',
    updated_at    = now()
  WHERE
    status            = 'processing'
    AND provider_order_id IS NULL
    AND updated_at    < now() - interval '15 minutes'
    AND order_type    IN ('data', 'airtime', 'utility', 'store_wallet_topup');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.system_logs (level, source, event, message, data)
    VALUES (
      'warn',
      'cron-auto-retry',
      'orders.auto_reset',
      format('Auto-reset %s stuck orders to failed and refunded', v_count),
      jsonb_build_object('count', v_count, 'triggered_at', now())
    );
  END IF;

  RETURN v_count;
END;
$$;

-- 3. Force failure and auto-refund on the 10 currently stuck processing orders immediately
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT id FROM public.orders 
    WHERE status = 'processing' 
      AND provider_order_id IS NULL
  ) LOOP
    -- Update status to trigger refund
    UPDATE public.orders 
    SET 
      status = 'fulfillment_failed', 
      failure_reason = 'Manual reset: recovered from processing glitch',
      updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;
