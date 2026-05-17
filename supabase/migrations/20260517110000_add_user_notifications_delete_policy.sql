-- Add DELETE policy for user_notifications so users can clear their own inbox items
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.user_notifications;
CREATE POLICY "Users can delete own notifications" 
  ON public.user_notifications
  FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);
