-- Fix missing column grants and update public view
GRANT SELECT (
  free_data_enabled,
  free_data_network,
  free_data_package_size,
  free_data_max_claims,
  free_data_claims_count,
  show_announcement,
  announcement_title,
  announcement_message,
  whatsapp_bot_prompt,
  home_page_video_url,
  home_page_video_muted
) ON public.system_settings TO anon, authenticated;

-- Update public_system_settings view to include everything needed by the frontend
DROP VIEW IF EXISTS public.public_system_settings;
CREATE VIEW public.public_system_settings AS
 SELECT 
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
    updated_at
   FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated;
