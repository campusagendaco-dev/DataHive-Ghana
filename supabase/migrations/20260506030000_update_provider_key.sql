-- Update system_settings with the new provider API key
UPDATE public.system_settings 
SET data_provider_api_key = 'REPLACE_WITH_YOUR_KEY'
WHERE id = 1;

-- Also ensure the primary provider in the providers table is updated if it exists
UPDATE public.providers
SET api_key = 'REPLACE_WITH_YOUR_KEY'
WHERE name ILIKE '%DataMart%' OR is_active = true;
