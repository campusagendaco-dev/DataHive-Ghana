-- Add API source toggle + secondary pricing markup controls
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS active_api_source text NOT NULL DEFAULT 'primary'
    CHECK (active_api_source IN ('primary', 'secondary')),
  ADD COLUMN IF NOT EXISTS secondary_price_markup_pct numeric(7,4) NOT NULL DEFAULT 8.11;

-- Ensure default row carries new defaults
UPDATE public.system_settings
SET
  active_api_source = COALESCE(NULLIF(active_api_source, ''), 'primary'),
  secondary_price_markup_pct = COALESCE(secondary_price_markup_pct, 8.11)
WHERE id = 1;
