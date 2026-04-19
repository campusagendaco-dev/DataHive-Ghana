ALTER TABLE public.system_settings
  ALTER COLUMN customer_service_number SET DEFAULT '0547636024';

UPDATE public.system_settings
SET customer_service_number = '0547636024'
WHERE id = 1
  AND (
    customer_service_number IS NULL
    OR customer_service_number = ''
    OR REPLACE(customer_service_number, ' ', '') IN ('+23356042269', '+233560042269', '+233203256540')
  );
