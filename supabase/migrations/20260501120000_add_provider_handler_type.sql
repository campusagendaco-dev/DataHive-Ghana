-- Add handler_type to providers table
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS handler_type TEXT DEFAULT 'standard';

-- Update existing providers to 'standard' if they don't have one
UPDATE public.providers SET handler_type = 'standard' WHERE handler_type IS NULL;

-- Comment on the column
COMMENT ON COLUMN public.providers.handler_type IS 'The logic handler to use for this provider (e.g., standard, datamart)';
