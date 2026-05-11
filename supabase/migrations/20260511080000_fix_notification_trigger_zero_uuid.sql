-- Fix: handle_order_notification_trigger crashes for orders where agent_id is
-- the zero UUID (00000000-0000-0000-0000-000000000000), used by developer API
-- orders with no real agent. The FK on user_notifications.user_id requires the
-- user to exist in auth.users — inserting with a non-existent UUID rolls back
-- the entire status UPDATE, leaving orders permanently stuck in 'processing'.

CREATE OR REPLACE FUNCTION public.handle_order_notification_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msg TEXT;
  v_title TEXT;
  v_fail_msg TEXT;
  v_fail_title TEXT;
BEGIN
  -- Guard: skip notifications for system/API orders where agent_id is not a real user
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.agent_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> COALESCE(OLD.status, 'none') THEN

    -- Build success message per order type
    IF NEW.order_type = 'wallet_topup' THEN
      v_title := '💰 Wallet Credited';
      v_msg   := 'GHS ' || COALESCE(NEW.amount::text, '0') || ' credited to your wallet.';
      v_fail_title := '❌ Wallet Top-up Failed';
      v_fail_msg   := 'Wallet top-up of GHS ' || COALESCE(NEW.amount::text, '0') || ' failed.';

    ELSIF NEW.order_type IN ('agent_activation', 'sub_agent_activation') THEN
      v_title := '🎉 Account Activated';
      v_msg   := 'Your reseller account is now active. Set up your store and start selling.';
      v_fail_title := '❌ Activation Failed';
      v_fail_msg   := 'Your account activation could not be completed. Please contact support.';

    ELSIF NEW.order_type = 'utility' THEN
      v_title := '✅ Utility Payment Sent';
      v_msg   := 'Your utility payment of GHS ' || COALESCE(NEW.amount::text, '0') || ' was processed successfully.';
      v_fail_title := '❌ Utility Payment Failed';
      v_fail_msg   := 'Your utility payment of GHS ' || COALESCE(NEW.amount::text, '0') || ' could not be processed.';

    ELSIF NEW.order_type = 'airtime' THEN
      v_title := '✅ Airtime Delivered';
      v_msg   := 'Airtime successfully delivered to ' || COALESCE(NEW.customer_phone, 'customer') || '.';
      v_fail_title := '❌ Airtime Failed';
      v_fail_msg   := 'Airtime for ' || COALESCE(NEW.customer_phone, 'customer') || ' could not be delivered.';

    ELSIF NEW.order_type = 'withdrawal' THEN
      v_title := '💸 Withdrawal Processed';
      v_msg   := 'GHS ' || COALESCE(NEW.amount::text, '0') || ' withdrawal has been processed.';
      v_fail_title := '❌ Withdrawal Failed';
      v_fail_msg   := 'Your withdrawal of GHS ' || COALESCE(NEW.amount::text, '0') || ' could not be processed.';

    ELSIF NEW.order_type IN ('afa', 'api_wallet_transfer', 'api') THEN
      v_title := '✅ Transaction Complete';
      v_msg   := 'Your transaction of GHS ' || COALESCE(NEW.amount::text, '0') || ' completed successfully.';
      v_fail_title := '❌ Transaction Failed';
      v_fail_msg   := 'Your transaction of GHS ' || COALESCE(NEW.amount::text, '0') || ' failed.';

    ELSE
      -- Default: data order
      v_title := '✅ Order Delivered';
      v_msg   := COALESCE(NEW.package_size, '') || ' (' || UPPER(COALESCE(NEW.network, '')) || ') delivered to ' || COALESCE(NEW.customer_phone, 'customer') || '.';
      v_fail_title := '❌ Order Failed';
      v_fail_msg   := 'Order for ' || COALESCE(NEW.customer_phone, 'customer') || ' failed. Funds restored to wallet.';
    END IF;

    IF NEW.status = 'fulfilled' AND v_msg IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, title, message, type, link)
      VALUES (NEW.agent_id, v_title, v_msg, 'success', '/dashboard/transactions');
    END IF;

    IF NEW.status = 'fulfillment_failed' AND v_fail_msg IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, title, message, type, link)
      VALUES (NEW.agent_id, v_fail_title, v_fail_msg, 'error', '/dashboard/transactions');
    END IF;

  END IF;

  -- Parent referral profit notification
  IF NEW.status = 'fulfilled'
     AND COALESCE(NEW.parent_profit, 0) > 0
     AND NEW.parent_agent_id IS NOT NULL
     AND COALESCE(OLD.status, 'none') <> 'fulfilled' THEN
    INSERT INTO public.user_notifications (user_id, title, message, type, link)
    VALUES (
      NEW.parent_agent_id,
      '🤝 Referral Commission Earned!',
      'You earned GHS ' || ROUND(NEW.parent_profit, 2) || ' from a sub-agent order.',
      'success',
      '/dashboard/profits'
    );
  END IF;

  RETURN NEW;
END;
$$;
