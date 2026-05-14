-- ============================================================
-- FIX: Missing data column on user_notifications
--      Missing INSERT policies for admin on system_logs
-- ============================================================

-- 1. Add data column to user_notifications (used by broadcast + refund functions)
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS data jsonb;

-- 2. Allow admins to insert rows into system_logs via client
DROP POLICY IF EXISTS "admins_insert_system_logs" ON public.system_logs;
CREATE POLICY "admins_insert_system_logs"
  ON public.system_logs FOR INSERT
  WITH CHECK (public.is_admin());

-- 3. Allow admins to insert notifications for any user (broadcast)
DROP POLICY IF EXISTS "admins_insert_user_notifications" ON public.user_notifications;
CREATE POLICY "admins_insert_user_notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (public.is_admin());
