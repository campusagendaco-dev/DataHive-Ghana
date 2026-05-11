-- Fix: handle_order_notification_trigger crashed on multiple order types
-- because customer_phone/network/package_size are NULL for non-data orders,
-- violating not-null constraint on user_notifications.message.
-- Comprehensive rewrite handles ALL order types with null-safe COALESCE logic.

CREATE OR REPLACE FUNCTION public.handle_order_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_title      TEXT;
  v_msg        TEXT;
  v_fail_title TEXT;
  v_fail_msg   TEXT;
BEGIN
  -- PART A: Agent Notifications (Order Fulfilled/Failed)
  IF NEW.agent_id IS NOT NULL AND NEW.status <> COALESCE(OLD.status, 'none') THEN

    -- Determine notification content per order type
    IF NEW.order_type = 'wallet_topup' THEN
      v_title      := '💰 Wallet Credited';
      v_msg        := 'Successfully credited GHS ' || COALESCE(NEW.amount::text, '0.00') || ' to your wallet via direct top-up.';
      v_fail_title := '❌ Wallet Top-up Failed';
      v_fail_msg   := 'Alert: Your wallet top-up of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' failed to process.';

    ELSIF NEW.order_type IN ('agent_activation', 'sub_agent_activation') THEN
      v_title      := '🎉 Account Activated';
      v_msg        := 'Your reseller account has been activated successfully! Set up your store and start selling.';
      v_fail_title := '❌ Activation Failed';
      v_fail_msg   := 'Your account activation could not be completed. Please contact support.';

    ELSIF NEW.order_type = 'utility' THEN
      v_title      := '✅ Utility Payment Sent';
      v_msg        := 'Your utility payment of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' was processed successfully.';
      v_fail_title := '❌ Utility Payment Failed';
      v_fail_msg   := 'Alert: Your utility payment of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' failed to process.';

    ELSIF NEW.order_type = 'airtime' THEN
      v_title      := '✅ Airtime Delivered';
      v_msg        := 'GHS ' || COALESCE(NEW.amount::text, '0.00') || ' airtime (' || UPPER(COALESCE(NEW.network, 'N/A')) || ') delivered to ' || COALESCE(NEW.customer_phone, 'customer') || '.';
      v_fail_title := '❌ Airtime Failed';
      v_fail_msg   := 'Alert: Airtime for ' || COALESCE(NEW.customer_phone, 'customer') || ' failed. Your funds have been restored.';

    ELSIF NEW.order_type = 'withdrawal' THEN
      v_title      := '💸 Withdrawal Processed';
      v_msg        := 'Your withdrawal of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' has been processed successfully.';
      v_fail_title := '❌ Withdrawal Failed';
      v_fail_msg   := 'Alert: Your withdrawal of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' could not be processed. Your funds have been restored.';

    ELSIF NEW.order_type IN ('afa', 'api_wallet_transfer', 'api') THEN
      v_title      := '✅ Transfer Completed';
      v_msg        := 'Your transfer of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' was completed successfully.';
      v_fail_title := '❌ Transfer Failed';
      v_fail_msg   := 'Alert: Your transfer of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' failed. Your funds have been restored.';

    ELSE
      -- Default: data bundle orders
      v_title      := '✅ Order Delivered';
      v_msg        := 'Success! ' || COALESCE(NEW.package_size, '') || ' (' || UPPER(COALESCE(NEW.network, '')) || ') delivered to ' || COALESCE(NEW.customer_phone, 'customer') || '.';
      v_fail_title := '❌ Order Failed';
      v_fail_msg   := 'Alert: The order for ' || COALESCE(NEW.customer_phone, 'customer') || ' failed. Your funds have been automatically restored to your wallet.';
    END IF;

    -- Insert fulfilled notification
    IF NEW.status = 'fulfilled' AND v_msg IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, title, message, type, link)
      VALUES (
        NEW.agent_id,
        v_title,
        v_msg,
        'success',
        CASE
          WHEN NEW.order_type IN ('agent_activation', 'sub_agent_activation') THEN '/dashboard'
          ELSE '/dashboard/transactions'
        END
      );
    END IF;

    -- Insert failed notification
    IF NEW.status = 'fulfillment_failed' AND v_fail_msg IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, title, message, type, link)
      VALUES (
        NEW.agent_id,
        v_fail_title,
        v_fail_msg,
        'error',
        CASE
          WHEN NEW.order_type IN ('agent_activation', 'sub_agent_activation') THEN '/dashboard'
          ELSE '/dashboard/transactions'
        END
      );
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
