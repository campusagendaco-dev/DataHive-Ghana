-- Add free agent promotion settings columns to system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS free_agent_promo_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS free_agent_promo_limit INTEGER DEFAULT 10;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS free_agent_promo_claimed INTEGER DEFAULT 0;

COMMENT ON COLUMN public.system_settings.free_agent_promo_enabled IS 'Whether the special 100% free agent promotion is active.';
COMMENT ON COLUMN public.system_settings.free_agent_promo_limit IS 'The total capacity/limit of free agent activations allowed.';
COMMENT ON COLUMN public.system_settings.free_agent_promo_claimed IS 'Current counter of how many free agent spots have been successfully claimed.';

-- Set reasonable default value on our single settings row
UPDATE public.system_settings
SET 
  free_agent_promo_enabled = false,
  free_agent_promo_limit = 10,
  free_agent_promo_claimed = 0
WHERE id = 1;

-- Rebuild the restricted public view to expose the promo settings safely to clients
DROP VIEW IF EXISTS public.public_system_settings CASCADE;

CREATE OR REPLACE VIEW public.public_system_settings AS
SELECT 
  id,
  auto_api_switch,
  holiday_mode_enabled,
  holiday_message,
  disable_ordering,
  dark_mode_enabled,
  store_visitor_popup_enabled,
  customer_service_number,
  support_channel_link,
  mtn_markup_percentage,
  telecel_markup_percentage,
  at_markup_percentage,
  show_announcement,
  announcement_title,
  announcement_message,
  free_data_enabled,
  free_data_network,
  free_data_package_size,
  free_data_max_claims,
  free_data_claims_count,
  home_page_video_url,
  home_page_video_muted,
  agent_activation_fee,
  wassce_price,
  bece_price,
  show_scrolling_ad,
  scrolling_ad_text,
  traditional_background_enabled,
  background_custom_image_url,
  -- NEW PROMO COLUMNS EXPOSED
  free_agent_promo_enabled,
  free_agent_promo_limit,
  free_agent_promo_claimed
FROM public.system_settings;

-- Restore permissions on rebuilt view
GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;
COMMENT ON VIEW public.public_system_settings IS 'Secured subset of system configurations visible to end users and dynamic layout hooks.';

-- CREATE ATOMIC RPC TO SECURELY CLAIM A FREE AGENT SLOT
CREATE OR REPLACE FUNCTION public.claim_free_agent_promo()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_claimed INT;
    v_limit INT;
    v_enabled BOOLEAN;
    v_is_already_agent BOOLEAN;
BEGIN
    -- 1. Must be authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'You must be logged in to claim this promotion.');
    END IF;

    -- 2. Row Lock system_settings at ID 1 to ensure absolute concurrency safety
    SELECT free_agent_promo_enabled, free_agent_promo_limit, free_agent_promo_claimed
    INTO v_enabled, v_limit, v_claimed
    FROM public.system_settings
    WHERE id = 1
    FOR UPDATE;

    -- 3. Promotion Availability Guardrails
    IF NOT COALESCE(v_enabled, false) THEN
        RETURN json_build_object('success', false, 'error', 'The free agent promotion is currently inactive.');
    END IF;

    IF v_claimed >= v_limit THEN
        RETURN json_build_object('success', false, 'error', 'All free agent promotional slots have already been claimed.');
    END IF;

    -- 4. User Eligibility Check
    SELECT COALESCE(is_agent, false) AND COALESCE(agent_approved, false) 
    INTO v_is_already_agent
    FROM public.profiles
    WHERE user_id = v_user_id;

    IF v_is_already_agent THEN
        RETURN json_build_object('success', false, 'error', 'You are already an active reseller agent.');
    END IF;

    -- 5. Commit the Claim Increment
    UPDATE public.system_settings
    SET free_agent_promo_claimed = free_agent_promo_claimed + 1
    WHERE id = 1;

    -- 6. Activate User as Reseller Immediately (leaving onboarding_complete for setup step)
    UPDATE public.profiles
    SET 
        is_agent = true,
        agent_approved = true,
        is_sub_agent = false,
        parent_agent_id = null,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- 7. Output Success state
    RETURN json_build_object(
        'success', true,
        'message', 'Congratulations! You secured a free agent slot.',
        'claimed_count', v_claimed + 1,
        'limit', v_limit
    );
END;
$$;

-- Grant authenticated users access to run the RPC
GRANT EXECUTE ON FUNCTION public.claim_free_agent_promo() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_free_agent_promo() FROM anon;

COMMENT ON FUNCTION public.claim_free_agent_promo IS 'Atomic procedure that locks settings, increments claimed counter, and activates agent status for free under promo parameters.';
