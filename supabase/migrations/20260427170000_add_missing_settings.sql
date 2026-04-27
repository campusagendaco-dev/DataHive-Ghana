-- ADD MISSING SETTINGS COLUMNS
-- These columns are required by the AdminSettings page for provider configuration and announcements.

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS data_provider_api_key TEXT,
ADD COLUMN IF NOT EXISTS data_provider_base_url TEXT,
ADD COLUMN IF NOT EXISTS airtime_provider_api_key TEXT,
ADD COLUMN IF NOT EXISTS secondary_data_provider_api_key TEXT,
ADD COLUMN IF NOT EXISTS secondary_data_provider_base_url TEXT,
ADD COLUMN IF NOT EXISTS auto_failover_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_announcement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS announcement_title TEXT DEFAULT 'Welcome to SwiftPoints!',
ADD COLUMN IF NOT EXISTS announcement_message TEXT DEFAULT 'You now earn rewards for every purchase. 100 points = GHS 1.00 cash back!';

-- Ensure there is at least one row with ID 1
INSERT INTO public.system_settings (id) 
VALUES (1) 
ON CONFLICT (id) DO NOTHING;
