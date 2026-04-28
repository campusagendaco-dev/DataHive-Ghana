-- Suspend flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- Admin action log
CREATE TABLE IF NOT EXISTS admin_action_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID,
  admin_email TEXT,
  action      TEXT        NOT NULL,
  target_user_id UUID,
  target_email   TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_log_select" ON admin_action_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_log_insert" ON admin_action_log
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT ALL ON admin_action_log TO service_role;

-- Toggle suspension via RPC
CREATE OR REPLACE FUNCTION toggle_user_suspension(p_user_id UUID, p_suspend BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET is_suspended = p_suspend WHERE user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION toggle_user_suspension(UUID, BOOLEAN) TO authenticated, service_role;

-- Account velocity: new accounts that placed their first order within 5 minutes of signup
CREATE OR REPLACE FUNCTION get_velocity_accounts()
RETURNS TABLE (
  user_id                UUID,
  full_name              TEXT,
  email                  TEXT,
  joined_at              TIMESTAMPTZ,
  first_order_at         TIMESTAMPTZ,
  minutes_to_first_order NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.created_at                                                       AS joined_at,
    MIN(o.created_at)                                                  AS first_order_at,
    ROUND(EXTRACT(EPOCH FROM (MIN(o.created_at) - p.created_at)) / 60, 1)
                                                                       AS minutes_to_first_order
  FROM profiles p
  JOIN orders o ON o.agent_id = p.user_id
  WHERE p.created_at > NOW() - INTERVAL '30 days'
  GROUP BY p.user_id, p.full_name, p.email, p.created_at
  HAVING EXTRACT(EPOCH FROM (MIN(o.created_at) - p.created_at)) BETWEEN 0 AND 300
  ORDER BY minutes_to_first_order ASC
  LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION get_velocity_accounts() TO authenticated, service_role;
