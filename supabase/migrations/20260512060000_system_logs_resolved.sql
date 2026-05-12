-- Add resolution tracking to system_logs
ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS resolved       boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by    uuid,
  ADD COLUMN IF NOT EXISTS resolution_note text;

CREATE INDEX IF NOT EXISTS idx_system_logs_unresolved
  ON public.system_logs (level, resolved)
  WHERE resolved = false;
