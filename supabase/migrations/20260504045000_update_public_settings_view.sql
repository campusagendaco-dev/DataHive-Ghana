-- Ensure columns exist in the base table
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS home_page_video_url TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS home_page_video_muted BOOLEAN DEFAULT TRUE;

-- Ensure public_system_settings view is fully up to date with all dynamic fields
DROP VIEW IF EXISTS public.public_system_settings;
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
  home_page_video_url,
  home_page_video_muted,
  agent_activation_fee
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated;
