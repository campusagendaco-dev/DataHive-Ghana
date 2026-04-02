ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS customer_service_number TEXT NOT NULL DEFAULT '+233203256540',
  ADD COLUMN IF NOT EXISTS support_channel_link TEXT NULL;

UPDATE public.system_settings
SET customer_service_number = COALESCE(NULLIF(customer_service_number, ''), '+233203256540')
WHERE id = 1;
