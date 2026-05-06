-- Expose api.authenticate_client to PostgREST via a public wrapper.
-- The api schema is not in PostgREST's exposed schemas, so functions there
-- are unreachable via supabase.rpc(). This shim delegates to the real function.

CREATE OR REPLACE FUNCTION public.authenticate_client(p_prefix TEXT, p_hash TEXT)
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
  RETURN QUERY SELECT * FROM api.authenticate_client(p_prefix, p_hash);
END;
$$;

-- Only callable by the service_role (edge functions), not end users
GRANT EXECUTE ON FUNCTION public.authenticate_client(TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.authenticate_client(TEXT, TEXT) FROM authenticated, anon;
