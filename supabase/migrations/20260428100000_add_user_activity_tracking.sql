-- Add IP tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

-- Fast RPC called by the edge function — increments login_count atomically
CREATE OR REPLACE FUNCTION log_user_activity(p_user_id UUID, p_ip TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    last_ip      = p_ip,
    last_seen_at = NOW(),
    login_count  = COALESCE(login_count, 0) + 1
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_user_activity(UUID, TEXT) TO service_role;
