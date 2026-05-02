
-- 1. FORCE 'pending' STATUS FOR ALL NEW PUBLIC ORDERS
-- Prevokes malicious users from inserting orders with status='paid' to bypass payment.
CREATE OR REPLACE FUNCTION public.force_order_pending_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Always force status to 'pending' for public inserts.
  -- Only service_role or admin can bypass this by updating later.
  NEW.status := 'pending';
  
  -- Reset sensitive financial columns to 0 or NULL to prevent manipulation
  NEW.profit := 0;
  NEW.parent_profit := 0;
  NEW.cost_price := NULL;
  NEW.profit_credited := FALSE;
  NEW.parent_profit_credited := FALSE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_force_order_pending ON public.orders;
CREATE TRIGGER tr_force_order_pending
BEFORE INSERT ON public.orders
FOR EACH ROW
WHEN (auth.role() = 'anon' OR auth.role() = 'authenticated')
EXECUTE FUNCTION public.force_order_pending_status();


-- 2. HARDEN RPC PERMISSIONS
-- Revoke execution from PUBLIC and only grant to service_role (Edge Functions).
REVOKE EXECUTE ON FUNCTION public.credit_order_profits(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_order_profits(TEXT) TO service_role;

-- 3. COLUMN-LEVEL INSERT RESTRICTIONS
-- Revoke full insert and grant only what's needed for the checkout flow.
REVOKE INSERT ON public.orders FROM anon, authenticated;
GRANT INSERT (
  id, 
  network, 
  package_size, 
  customer_phone, 
  amount, 
  order_type,
  metadata
) ON public.orders TO anon, authenticated;

-- 4. ENSURE SERVICE ROLE CAN STILL DO EVERYTHING
GRANT INSERT ON public.orders TO service_role;
GRANT UPDATE ON public.orders TO service_role;
GRANT SELECT ON public.orders TO service_role;
