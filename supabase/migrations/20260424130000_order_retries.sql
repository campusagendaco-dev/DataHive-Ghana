-- Add columns for tracking automated retries
ALTER TABLE orders ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;

-- Enable pg_cron if not already enabled (this may require superuser, but we'll try)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The actual fulfillment retry logic will be handled by an Edge Function
-- This migration just prepares the data structure.
