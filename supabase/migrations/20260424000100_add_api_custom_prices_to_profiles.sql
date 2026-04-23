-- Add api_custom_prices column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_custom_prices JSONB DEFAULT '{}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN profiles.api_custom_prices IS 'User-specific price overrides for API calls. Format: { "MTN": { "1GB": 4.50 }, ... }';
