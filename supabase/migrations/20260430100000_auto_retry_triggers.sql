-- Auto-retry triggers: invoke process-retries edge function whenever an order
-- transitions to 'paid' (needs first fulfillment attempt) or to
-- 'fulfillment_failed' with retries remaining (< 3 attempts used so far).

-- ── 1. Trigger function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_retry_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire when the order needs fulfillment or a retry is still allowed
  IF NEW.status = 'paid'
     OR (NEW.status = 'fulfillment_failed' AND COALESCE(NEW.retry_count, 0) < 3)
  THEN
    PERFORM net.http_post(
      url     := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/process-retries',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Attach trigger to orders ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_order_needs_fulfillment ON orders;

CREATE TRIGGER on_order_needs_fulfillment
  AFTER INSERT OR UPDATE OF status
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_retry_order();
