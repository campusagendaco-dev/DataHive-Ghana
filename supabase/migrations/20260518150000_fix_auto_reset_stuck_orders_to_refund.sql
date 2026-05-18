-- 20260518150000_fix_auto_reset_stuck_orders_to_refund.sql
-- Modifies the auto-reset routine to set stuck processing orders (no provider submission after 15 min)
-- to 'fulfillment_failed' instead of 'paid'. This triggers the auto-refund system immediately,
-- freeing up customer locked balances safely.

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
    AND order_type    IN ('data', 'airtime');

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
