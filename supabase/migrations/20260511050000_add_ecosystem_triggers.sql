-- ==========================================
-- 1. AUGMENT ORDER TRIGGER FOR REFERRAL EARNINGS
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_order_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
            'Alert: Your wallet top-up of GHS ' || COALESCE(NEW.amount::text, '0.00') || ' failed to process.', 
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

  -- PART B: Parent Referral Profit Notification (Recommendation B)
  -- Fired when order transitions to fulfilled and yielded distinct parent profit
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


-- ==========================================
-- 2. ACTIVATE WELCOME WAVES FOR NEW USERS
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, title, message, type, link)
  VALUES (
    NEW.user_id,
    '🎉 Welcome to SwiftData!',
    'We are thrilled to have you! Fund your account and start enjoying the cheapest data rates available!',
    'info',
    '/dashboard/wallet'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_profile_welcome ON public.profiles;
CREATE TRIGGER trg_on_profile_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_welcome_notification();


-- ==========================================
-- 3. ACTIVATE WITHDRAWAL APPROVAL ALERTS
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_withdrawal_status_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status <> COALESCE(OLD.status, 'none') THEN
    IF NEW.status = 'completed' THEN
      INSERT INTO public.user_notifications (user_id, title, message, type, link)
      VALUES (
        NEW.agent_id,
        '💸 Withdrawal Successful',
        'Great news! Your withdrawal request for GHS ' || ROUND(NEW.amount, 2) || ' has been completed.',
        'success',
        '/dashboard/withdraw'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.user_notifications (user_id, title, message, type, link)
      VALUES (
        NEW.agent_id,
        '❌ Withdrawal Rejected',
        'Your withdrawal request for GHS ' || ROUND(NEW.amount, 2) || ' was not approved. Please contact support for assistance.',
        'error',
        '/dashboard/withdraw'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_withdrawal_notify ON public.withdrawals;
CREATE TRIGGER trg_on_withdrawal_notify
  AFTER UPDATE OF status ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_withdrawal_status_notification();
