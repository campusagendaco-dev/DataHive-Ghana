-- Add voucher prices to system settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS wassce_price NUMERIC DEFAULT 18.00;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS bece_price NUMERIC DEFAULT 15.00;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS wassce_cost_price NUMERIC DEFAULT 17.00;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS bece_cost_price NUMERIC DEFAULT 14.00;

-- Ensure they maintain standard defaults
ALTER TABLE public.system_settings ALTER COLUMN wassce_price SET DEFAULT 18.00;
ALTER TABLE public.system_settings ALTER COLUMN bece_price SET DEFAULT 15.00;
ALTER TABLE public.system_settings ALTER COLUMN wassce_cost_price SET DEFAULT 17.00;
ALTER TABLE public.system_settings ALTER COLUMN bece_cost_price SET DEFAULT 14.00;

-- Refresh public view to expose the retail prices (do not expose cost price to the public!)
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
  agent_activation_fee,
  wassce_price,
  bece_price
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated;
