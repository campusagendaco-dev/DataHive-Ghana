ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS customer_service_number TEXT NOT NULL DEFAULT '0547636024',
  ADD COLUMN IF NOT EXISTS support_channel_link TEXT NULL;

UPDATE public.system_settings
SET customer_service_number = CASE
  WHEN customer_service_number IS NULL OR customer_service_number = '' THEN '0547636024'
  WHEN REPLACE(customer_service_number, ' ', '') IN ('+23356042269', '+233560042269', '+233203256540') THEN '0547636024'
  ELSE customer_service_number
END
WHERE id = 1;
