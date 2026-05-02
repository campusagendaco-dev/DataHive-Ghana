-- FIX API KEY ROTATION AND VISIBILITY
-- Allows users to rotate their own keys while keeping access/limits locked.

-- 1. Grant visibility on hashed key columns to authenticated users
-- Without this, the dashboard cannot see if a key is already set.
GRANT SELECT (api_key_prefix, api_key_hash) ON public.profiles TO authenticated;

-- 2. Update the security trigger to allow self-rotation of keys
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

  -- NOTE: We REMOVED the protection for api_key, api_key_hash, and api_key_prefix.
  -- This allows users to rotate their own keys from the dashboard.

  -- 3. Protect Referral & Financial metadata
  IF NEW.parent_agent_id IS DISTINCT FROM OLD.parent_agent_id THEN
    NEW.parent_agent_id := OLD.parent_agent_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_privileged_fields() IS 'Protects approval flags and API limits, but allows self-rotation of API keys.';
