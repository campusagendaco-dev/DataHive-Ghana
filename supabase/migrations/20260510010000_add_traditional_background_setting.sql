-- Add columns for global background configuration
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS traditional_background_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS background_custom_image_url TEXT;

-- Update public view if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_views WHERE viewname = 'public_system_settings') THEN
        DROP VIEW IF EXISTS public_system_settings;
        CREATE VIEW public_system_settings AS
        SELECT 
            holiday_mode_enabled,
            holiday_message,
            disable_ordering,
            customer_service_number,
            support_channel_link,
            show_announcement,
            announcement_title,
            announcement_message,
            free_data_enabled,
            free_data_network,
            free_data_package_size,
            free_data_max_claims,
            free_data_claims_count,
            show_scrolling_ad,
            scrolling_ad_text,
            wassce_price,
            bece_price,
            traditional_background_enabled,
            background_custom_image_url
        FROM system_settings
        LIMIT 1;
        
        GRANT SELECT ON public_system_settings TO anon, authenticated;
    END IF;
END
$$;
