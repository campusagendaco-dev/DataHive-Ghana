-- Fix API Key Rotation and Visbility Permissions
-- Redefine public.protect_profile_privileged_fields trigger function to allow key rotation by agents
-- Grant UPDATE privilege on key columns to authenticated users
-- Create secure RPC api.rotate_api_key for robust server-side generation & hashing

-- 1. Grant SELECT and UPDATE permissions on key columns to authenticated users
GRANT SELECT, UPDATE (api_key_prefix, api_key_hash, api_secret_key_hash) ON public.profiles TO authenticated;

-- 2. Ensure trigger function is correctly defined and up to date
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user is an admin OR it's the service role, let them change anything.
  IF public.has_role(auth.uid(), 'admin') OR (current_setting('role') = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- 1. Protect Agent/Sub-Agent Status & Approval
  IF NEW.is_agent IS DISTINCT FROM OLD.is_agent THEN
    NEW.is_agent := OLD.is_agent;
  END IF;

  IF NEW.agent_approved IS DISTINCT FROM OLD.agent_approved THEN
    NEW.agent_approved := OLD.agent_approved;
  END IF;

  IF NEW.sub_agent_approved IS DISTINCT FROM OLD.sub_agent_approved THEN
    NEW.sub_agent_approved := OLD.sub_agent_approved;
  END IF;

  -- Allow setting is_sub_agent to TRUE during onboarding, but block un-setting it later.
  IF NEW.is_sub_agent IS DISTINCT FROM OLD.is_sub_agent THEN
    IF OLD.is_sub_agent = true OR OLD.sub_agent_approved = true THEN
      NEW.is_sub_agent := OLD.is_sub_agent;
    END IF;
  END IF;

  -- 2. Protect API Control Fields (Prevent self-enablement and rate limit changes)
  IF NEW.api_access_enabled IS DISTINCT FROM OLD.api_access_enabled THEN
    NEW.api_access_enabled := OLD.api_access_enabled;
  END IF;

  IF NEW.api_rate_limit IS DISTINCT FROM OLD.api_rate_limit THEN
    NEW.api_rate_limit := OLD.api_rate_limit;
  END IF;

  IF NEW.api_allowed_actions IS DISTINCT FROM OLD.api_allowed_actions THEN
    NEW.api_allowed_actions := OLD.api_allowed_actions;
  END IF;

  -- NOTE: We explicitly omit api_key, api_key_hash, api_key_prefix, and api_secret_key_hash.
  -- This allows users to rotate their own keys and secrets from the dashboard.

  -- 3. Protect Referral & Financial metadata
  IF NEW.parent_agent_id IS DISTINCT FROM OLD.parent_agent_id THEN
    NEW.parent_agent_id := OLD.parent_agent_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create SECURE RPC for API Key rotation (highly recommended over client-side generation)
CREATE OR REPLACE FUNCTION api.rotate_api_key()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, api
AS $$
DECLARE
  v_new_key TEXT;
  v_key_hash TEXT;
  v_prefix TEXT;
  v_new_secret TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Generate 32-char hex API Key
  v_new_key := 'swft_live_' || lower(replace(gen_random_uuid()::text, '-', ''));
  v_key_hash := encode(sha256(v_new_key::bytea), 'hex');
  v_prefix := left(v_new_key, 12);

  -- Generate 32-char hex Secret Key
  v_new_secret := lower(replace(gen_random_uuid()::text, '-', ''));

  UPDATE public.profiles
  SET 
    api_key_hash = v_key_hash,
    api_key_prefix = v_prefix,
    api_secret_key_hash = v_new_secret,
    api_access_enabled = true
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'api_key', v_new_key,
    'prefix', v_prefix,
    'secret', v_new_secret
  );
END;
$$;

-- 4. Grant EXECUTE privilege on the secure RPC to authenticated users
GRANT EXECUTE ON FUNCTION api.rotate_api_key() TO authenticated;
