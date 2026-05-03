-- ADMIN & DASHBOARD UPDATES FOR API HARDENING
-- Adding logging visibility and RLS

-- 1. Enable RLS on api_logs
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Agents can see their own logs
CREATE POLICY "Agents can view their own api logs"
  ON public.api_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Policy: Admins can see all logs
CREATE POLICY "Admins can view all api logs"
  ON public.api_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND (is_admin = true OR is_super_admin = true)
    )
  );

-- 4. View for Agents (Filtered by RLS)
CREATE OR REPLACE VIEW api.v_logs AS
SELECT 
  id,
  endpoint,
  method,
  log_reference,
  error_message,
  created_at
FROM public.api_logs;

-- 5. Grant permissions
GRANT SELECT ON api.v_logs TO authenticated;
GRANT SELECT ON public.api_logs TO authenticated;
