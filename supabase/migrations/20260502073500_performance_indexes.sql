-- Performance optimization: Indexes for faster order lookups and retries
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_api_access_enabled ON profiles(api_access_enabled) WHERE api_access_enabled = true;
