-- FIX: Grant SELECT to authenticated so RLS can filter for admins.
GRANT SELECT, UPDATE ON public.system_settings TO authenticated;

-- Ensure RLS is active and correct.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
