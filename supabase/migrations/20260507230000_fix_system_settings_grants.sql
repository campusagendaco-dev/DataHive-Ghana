-- Grant SELECT permissions on all non-sensitive columns of system_settings to anon and authenticated.
-- This ensures that the public_system_settings view can be queried successfully by the frontend without permission errors.

GRANT SELECT (
  id,
  disable_ordering,
  dark_mode_enabled,
  store_visitor_popup_enabled,
  customer_service_number,
  support_channel_link,
  holiday_mode_enabled,
  holiday_message,
  mtn_markup_percentage,
  telecel_markup_percentage,
  at_markup_percentage,
  auto_pending_sms_enabled,
  show_announcement,
  announcement_title,
  announcement_message,
  free_data_enabled,
  free_data_network,
  free_data_package_size,
  free_data_max_claims,
  free_data_claims_count,
  whatsapp_bot_prompt,
  home_page_video_url,
  home_page_video_muted,
  updated_at,
  agent_activation_fee,
  sub_agent_base_fee,
  show_scrolling_ad,
  scrolling_ad_text,
  scrolling_ad_image_url
) ON public.system_settings TO anon, authenticated;
