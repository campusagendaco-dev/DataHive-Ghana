-- Expose api.rotate_api_key to PostgREST via a public wrapper
-- The api schema is not exposed by default; this public shim delegates to it.

CREATE OR REPLACE FUNCTION public.rotate_api_key()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
BEGIN
  RETURN api.rotate_api_key();
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_api_key() TO authenticated;
