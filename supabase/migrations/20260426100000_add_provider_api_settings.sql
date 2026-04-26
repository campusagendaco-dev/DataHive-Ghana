-- Add JustBuy API configuration columns to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS data_provider_api_key TEXT,
  ADD COLUMN IF NOT EXISTS data_provider_base_url TEXT DEFAULT 'https://dev.justbuygh.com',
  ADD COLUMN IF NOT EXISTS airtime_provider_api_key TEXT;

-- Update the comments for clarity
COMMENT ON COLUMN system_settings.data_provider_api_key IS 'Main API key for JustBuy Ghana (Data).';
COMMENT ON COLUMN system_settings.data_provider_base_url IS 'Base URL for JustBuy API endpoints.';
COMMENT ON COLUMN system_settings.airtime_provider_api_key IS 'Optional separate API key for Airtime purchases.';
