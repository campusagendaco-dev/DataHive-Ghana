-- Fix: handle_order_notification_trigger crashed on agent_activation orders
-- because customer_phone is NULL for activations, violating not-null constraint on user_notifications.message
-- Also adds a dedicated "Account Activated" notification for agent/sub-agent activations.

CREATE OR REPLACE FUNCTION public.handle_order_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- PART A: Agent Notifications (Order Fulfilled/Failed)
  IF NEW.agent_id IS NOT NULL AND NEW.status <> COALESCE(OLD.status, 'none') THEN

    -- SCENARIO A: Order Successfully Fulfilled
    IF NEW.status = 'fulfilled' THEN
       IF NEW.order_type = 'wallet_topup' THEN
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id,
            '💰 Wallet Credited',
            'Successfully credited GHS ' || COALESCE(NEW.amount::text, '0.00') || ' to your wallet via direct top-up.',
            'success',
            '/dashboard/transactions'
          );
       ELSIF NEW.order_type IN ('agent_activation', 'sub_agent_activation') THEN
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id,
            '🎉 Account Activated',
            'Your reseller account has been activated successfully! Set up your store and start selling.',
            'success',
            '/dashboard'
          );
       ELSE
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id,
            '✅ Order Delivered',
            'Success! ' || COALESCE(NEW.package_size, '') || ' (' || UPPER(COALESCE(NEW.network, '')) || ') has been successfully delivered to ' || COALESCE(NEW.customer_phone, 'customer') || '.',
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
            'Alert: Your wallet top-up of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' failed to process.',
            'error',
            '/dashboard/transactions'
          );
       ELSIF NEW.order_type IN ('agent_activation', 'sub_agent_activation') THEN
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id,
            '❌ Activation Failed',
            'Your account activation could not be completed. Please contact support.',
            'error',
            '/dashboard'
          );
       ELSE
          INSERT INTO public.user_notifications (user_id, title, message, type, link)
          VALUES (
            NEW.agent_id,
            '❌ Order Failed',
            'Alert: The order for ' || COALESCE(NEW.customer_phone, 'customer') || ' failed to deliver. Your funds have been automatically restored to your wallet.',
            'error',
            '/dashboard/transactions'
          );
       END IF;
    END IF;

  END IF;

  -- PART B: Parent Referral Profit Notification
  IF NEW.status = 'fulfilled'
     AND COALESCE(NEW.parent_profit, 0) > 0
     AND NEW.parent_agent_id IS NOT NULL
     AND COALESCE(OLD.status, 'none') <> 'fulfilled' THEN

     INSERT INTO public.user_notifications (user_id, title, message, type, link)
     VALUES (
       NEW.parent_agent_id,
       '🤝 Referral Commission Earned!',
       'Ka-ching! You just earned GHS ' || ROUND(NEW.parent_profit, 2) || ' from an order placed by a sub-agent.',
       'success',
       '/dashboard/profits'
     );
  END IF;

  RETURN NEW;
END;
$$;
