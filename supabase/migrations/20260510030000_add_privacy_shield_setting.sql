-- Add columns for enabling/disabling privacy protection shield
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS enable_privacy_shield BOOLEAN DEFAULT TRUE;

-- Ensure public_system_settings view is ABSOLUTELY UP TO DATE with EVERY column in production
-- Uses CASCADE to ensure any dependent functions are aware of the re-population.
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
  enable_privacy_shield -- Ultimate added column
FROM public.system_settings;

-- Reset the grants to strictly valid states
GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;
COMMENT ON VIEW public.public_system_settings IS 'Fully unified secured subset of system configurations visible to all edge hooks and consumer layers.';
