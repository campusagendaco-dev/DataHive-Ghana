-- Add foreign key to audit_logs for easier joining with profiles in the UI
ALTER TABLE public.audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey,
  ADD CONSTRAINT audit_logs_admin_id_fkey 
  FOREIGN KEY (admin_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE SET NULL;

-- Ensure an index exists for performance as logs grow
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);

-- Optional: Insert a "System Audit Check" log if the table is empty
INSERT INTO public.audit_logs (action, details)
SELECT 'system_integrity_check', '{"status": "active", "message": "Audit logging system verified and operational"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs LIMIT 1);
