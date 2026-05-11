-- 1. Create order status monitoring trigger function
CREATE OR REPLACE FUNCTION public.handle_order_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Trigger ONLY when status actually changes and user is known
  IF NEW.agent_id IS NOT NULL AND NEW.status <> COALESCE(OLD.status, 'none') THEN
    
    -- SCENARIO A: Order Successfully Fulfilled
    IF NEW.status = 'fulfilled' THEN
       IF NEW.order_type = 'wallet_topup' THEN
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id, 
            '💰 Wallet Credited', 
            'Successfully credited GHS ' || NEW.amount || ' to your wallet via direct top-up.', 
            'success', 
            '/dashboard/transactions'
          );
       ELSE
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id, 
            '✅ Order Delivered', 
            'Success! ' || COALESCE(NEW.package_size, '') || ' (' || UPPER(COALESCE(NEW.network, '')) || ') has been successfully delivered to ' || NEW.customer_phone || '.', 
            'success', 
            '/dashboard/transactions'
          );
       END IF;
    END IF;

    -- SCENARIO B: Order Failed completely
    IF NEW.status = 'fulfillment_failed' THEN
       IF NEW.order_type = 'wallet_topup' THEN
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id, 
            '❌ Wallet Top-up Failed', 
            'Alert: Your wallet top-up of GHS ' || NEW.amount || ' failed to process.', 
            'error', 
            '/dashboard/transactions'
          );
       ELSE
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id, 
            '❌ Order Failed', 
            'Alert: The order for ' || NEW.customer_phone || ' failed to deliver. Your funds have been automatically restored to your wallet.', 
            'error', 
            '/dashboard/transactions'
          );
       END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to Orders table
DROP TRIGGER IF EXISTS trg_on_order_status_notify ON public.orders;
CREATE TRIGGER trg_on_order_status_notify
  AFTER INSERT OR UPDATE OF status
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_notification_trigger();
