-- Create provider_packages table
CREATE TABLE IF NOT EXISTS public.provider_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
    network TEXT NOT NULL, -- MTN, TELECEL, AT_PREMIUM
    package_name TEXT NOT NULL, -- e.g., '1GB', '5GB'
    capacity_gb NUMERIC NOT NULL,
    cost_price NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT true,
    external_id TEXT, -- ID from the provider's system
    raw_data JSONB, -- For any extra info from provider
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(provider_id, network, package_name)
);

-- Enable RLS
ALTER TABLE public.provider_packages ENABLE ROW LEVEL SECURITY;

-- Only admins can manage provider packages
DROP POLICY IF EXISTS "Admins can manage provider packages" ON public.provider_packages;
CREATE POLICY "Admins can manage provider packages" 
ON public.provider_packages FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Allow agents to view active packages (optional, but good for cost transparency in admin)
DROP POLICY IF EXISTS "Anyone can view active provider packages" ON public.provider_packages;
CREATE POLICY "Anyone can view active provider packages"
ON public.provider_packages FOR SELECT
USING (is_active = true);

-- Add last_synced_at to providers if it doesn't exist
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
