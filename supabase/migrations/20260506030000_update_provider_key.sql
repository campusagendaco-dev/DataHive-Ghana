-- Update system_settings with the new provider API key
UPDATE public.system_settings 
SET data_provider_api_key = 'swft_live_placeholder_rotate_in_dashboard'
WHERE id = 1;

-- Also ensure the primary provider in the providers table is updated if it exists
UPDATE public.providers
SET api_key = 'swft_live_placeholder_rotate_in_dashboard'
WHERE name ILIKE '%DataMart%' OR is_active = true;
