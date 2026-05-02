-- Add agent_activation_fee column to system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS agent_activation_fee NUMERIC DEFAULT 50.00;

-- Update existing row to set the new fee
UPDATE public.system_settings SET agent_activation_fee = 50.00 WHERE id = 1;

-- Add comment for clarity
COMMENT ON COLUMN public.system_settings.agent_activation_fee IS 'The fee required to activate a reseller/agent account.';
