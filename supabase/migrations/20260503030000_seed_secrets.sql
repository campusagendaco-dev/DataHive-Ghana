-- SEED SECRET KEYS FOR EXISTING AGENTS
-- This ensures existing agents get a secret key hash so they can use HMAC signing.

UPDATE public.profiles
SET api_secret_key_hash = encode(digest(gen_random_uuid()::text, 'sha256'), 'hex')
WHERE (is_agent = true OR is_sub_agent = true)
  AND api_secret_key_hash IS NULL;
