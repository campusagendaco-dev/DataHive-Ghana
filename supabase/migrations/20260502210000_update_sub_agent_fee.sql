-- Update both agent and sub-agent activation base fees to 50.00
ALTER TABLE public.system_settings 
  ALTER COLUMN agent_activation_fee SET DEFAULT 50.00,
  ALTER COLUMN sub_agent_base_fee SET DEFAULT 50.00;

UPDATE public.system_settings 
SET 
  agent_activation_fee = 50.00,
  sub_agent_base_fee = 50.00
WHERE id = 1;

COMMENT ON COLUMN public.system_settings.sub_agent_base_fee IS 'The platform share taken from a sub-agent activation fee.';
