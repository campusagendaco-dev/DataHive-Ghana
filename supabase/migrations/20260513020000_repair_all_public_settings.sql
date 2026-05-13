-- REPAIR ALL PUBLIC SETTINGS VIEW
-- Integrates every public column added recently (privacy shield, background images, voucher prices, maintenance, free agent promotion, etc.)
-- ensuring that standard clients can access all required system settings without column-level blockades.

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
  maintenance_started_at,
  maintenance_eta,
  withdrawal_auto_approve_enabled,
  withdrawal_auto_approve_max_amount,
  withdrawal_auto_approve_min_age_days,
  withdrawal_auto_approve_require_no_chargebacks,
  free_agent_promo_enabled,
  free_agent_promo_limit,
  free_agent_promo_claimed,
  updated_at
FROM public.system_settings;

-- Grant SELECT to normal users and anonymous users
GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;

COMMENT ON VIEW public.public_system_settings IS 'Fully unified public system settings view with all recent feature columns, excluding backend credentials.';
