-- Fix api.authenticate_client to include test_mode column.
-- The api_test_mode column was added to profiles but the function signature
-- was never updated, causing a column-count mismatch that crashed every auth call.

DROP FUNCTION IF EXISTS api.authenticate_client(TEXT, TEXT);

CREATE FUNCTION api.authenticate_client(p_prefix TEXT, p_hash TEXT)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  secret_key_hash TEXT,
  access_enabled BOOLEAN,
  rate_limit INTEGER,
  allowed_actions TEXT[],
  ip_whitelist TEXT[],
  webhook_url TEXT,
  is_sub_agent BOOLEAN,
  parent_agent_id UUID,
  custom_prices JSONB,
  test_mode BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.api_secret_key_hash,
    p.api_access_enabled,
    p.api_rate_limit::INTEGER,
    p.api_allowed_actions,
    p.api_ip_whitelist,
    p.api_webhook_url,
    p.is_sub_agent,
    p.parent_agent_id,
    p.api_custom_prices,
    p.api_test_mode
  FROM public.profiles p
  WHERE p.api_key_prefix = p_prefix AND p.api_key_hash = p_hash;
END;
$$;
