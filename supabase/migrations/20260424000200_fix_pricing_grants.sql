-- Fix grants for new API pricing columns
-- Allow authenticated users (admins) to see the custom API prices
GRANT SELECT (api_custom_prices) ON public.profiles TO authenticated;

-- Allow anyone to see the global API prices
-- First check if we need to grant specifically or if it's open
-- In the hardening migration, we didn't restrict global_package_settings columns,
-- but just to be safe if a future migration does, we ensure access here.
GRANT SELECT (api_price) ON public.global_package_settings TO anon, authenticated;
