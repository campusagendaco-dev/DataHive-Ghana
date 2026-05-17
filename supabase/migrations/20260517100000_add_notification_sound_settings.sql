-- 20260517100000_add_notification_sound_settings.sql
-- Add custom notification sound and mobile vibration configurations to system settings.

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS notification_tone text DEFAULT '/sounds/notification_system.mp3',
ADD COLUMN IF NOT EXISTS notification_vibration_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_vibration_pattern text DEFAULT '200,100,200';

-- Refresh the public view public_system_settings to include these columns
DROP VIEW IF EXISTS public.public_system_settings CASCADE;
CREATE VIEW public.public_system_settings WITH (security_invoker = true) AS
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
  sub_agent_base_fee,
  wassce_price,
  bece_price,
  show_scrolling_ad,
  scrolling_ad_text,
  scrolling_ad_image_url,
  traditional_background_enabled,
  background_custom_image_url,
  enable_privacy_shield,
  maintenance_mode,
  maintenance_message,
  withdrawal_auto_approve_enabled,
  withdrawal_auto_approve_max_amount,
  withdrawal_auto_approve_min_age_days,
  withdrawal_auto_approve_require_no_chargebacks,
  min_withdrawal_amount,
  withdrawal_system_enabled,
  notification_tone,
  notification_vibration_enabled,
  notification_vibration_pattern,
  updated_at
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;
