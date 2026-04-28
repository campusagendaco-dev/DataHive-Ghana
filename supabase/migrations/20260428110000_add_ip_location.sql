ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_location TEXT;

CREATE OR REPLACE FUNCTION log_user_activity(p_user_id UUID, p_ip TEXT, p_location TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    last_ip       = p_ip,
    last_location = COALESCE(p_location, last_location),
    last_seen_at  = NOW(),
    login_count   = COALESCE(login_count, 0) + 1
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_user_activity(UUID, TEXT, TEXT) TO service_role;
