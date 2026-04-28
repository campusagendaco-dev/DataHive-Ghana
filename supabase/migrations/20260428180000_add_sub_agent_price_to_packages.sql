-- Add sub_agent_price column to global_package_settings
ALTER TABLE public.global_package_settings ADD COLUMN IF NOT EXISTS sub_agent_price DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.global_package_settings.sub_agent_price IS 'Dedicated price for sub-agents. If NULL, defaults to agent_price.';

-- Update RLS to allow viewing the new column (should already be covered by existing SELECT * or specific columns)
GRANT SELECT (sub_agent_price) ON public.global_package_settings TO anon, authenticated;
