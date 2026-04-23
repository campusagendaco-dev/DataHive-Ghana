-- Add api_price column to global_package_settings
ALTER TABLE global_package_settings ADD COLUMN IF NOT EXISTS api_price DECIMAL(10,2) DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN global_package_settings.api_price IS 'Dedicated price for API users. If NULL, defaults to agent_price.';
