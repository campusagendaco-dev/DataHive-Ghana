-- ==========================================
-- 1. AUGMENT ORDER TRIGGER FOR REFERRAL EARNINGS
-- NOTE: The comprehensive null-safe version is defined in
-- 20260511030000_fix_notification_trigger_null_phone.sql (runs before this file).
-- We intentionally do NOT redefine handle_order_notification_trigger() here
-- to avoid overwriting that fix with a partial version.
-- ==========================================


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
