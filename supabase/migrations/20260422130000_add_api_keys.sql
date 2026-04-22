-- Add API Key column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_api_key ON profiles(api_key);

-- Add a comment for clarity
COMMENT ON COLUMN profiles.api_key IS 'Unique API key for developer access to programmatic data purchases.';
