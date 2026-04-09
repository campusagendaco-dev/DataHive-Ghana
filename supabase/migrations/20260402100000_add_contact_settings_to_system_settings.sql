ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS customer_service_number TEXT NOT NULL DEFAULT '+233 56 042 269',
  ADD COLUMN IF NOT EXISTS support_channel_link TEXT NULL;

UPDATE public.system_settings
SET customer_service_number = COALESCE(NULLIF(customer_service_number, ''), '+233 56 042 269')
WHERE id = 1;
