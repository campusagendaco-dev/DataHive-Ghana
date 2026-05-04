ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS show_scrolling_ad BOOLEAN DEFAULT FALSE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS scrolling_ad_image_url TEXT;

-- Update public view
DROP VIEW IF EXISTS public.public_system_settings;
CREATE OR REPLACE VIEW public.public_system_settings AS
SELECT
  id,
  holiday_mode_enabled,
  holiday_message,
  disable_ordering,
  maintenance_mode,
  registration_enabled,
  dark_mode_enabled,
  store_visitor_popup_enabled,
  customer_service_number,
  support_channel_link,
  free_data_enabled,
  free_data_network,
  free_data_package_size,
  auto_pending_sms_enabled,
  mtn_markup_percentage,
  telecel_markup_percentage,
  at_markup_percentage,
  show_scrolling_ad,
  scrolling_ad_image_url,
  updated_at
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated;
