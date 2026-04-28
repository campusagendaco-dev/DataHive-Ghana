-- Add separate base URL for airtime provider
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS airtime_provider_base_url TEXT;

COMMENT ON COLUMN system_settings.airtime_provider_base_url IS 'Optional separate base URL for Airtime purchases if different from Data provider.';

-- Add provider order ID to orders table for better tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
