
-- Add performance indexes for high-volume order tracking
-- This ensures that searching through 100k+ orders by phone number or agent ID remains instant.

-- Index for tracking orders by customer phone number
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);

-- Compound index for agent dashboard (filtering by agent and sorting by date)
CREATE INDEX IF NOT EXISTS idx_orders_agent_id_created_at ON public.orders (agent_id, created_at DESC);

-- Index for status-based lookups (useful for retries and admin monitoring)
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- Index for profile lookups by phone (used in agent management and registration checks)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);

-- Index for profile lookups by email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Analyze tables to update statistics for the query planner
ANALYZE public.orders;
ANALYZE public.profiles;
