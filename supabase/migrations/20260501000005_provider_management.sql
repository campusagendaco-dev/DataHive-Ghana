-- Migration: Provider Management & Smart Routing
-- Description: Adds infrastructure for multi-provider support and automatic failover.

-- 1. Create providers table
CREATE TABLE IF NOT EXISTS public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    api_key TEXT,
    api_secret TEXT,
    base_url TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1, -- Lower number = Higher priority
    balance NUMERIC DEFAULT 0,
    last_balance_check TIMESTAMP WITH TIME ZONE,
    provider_type TEXT NOT NULL, -- 'data', 'airtime', 'utility', 'sms'
    settings JSONB DEFAULT '{}', -- Provider-specific configurations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Only admins can manage providers
CREATE POLICY "Admins can manage providers" 
ON public.providers FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. Add provider_id to orders to track which provider was used
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_response JSONB;

-- 3. Create a log table for provider failures (for the Smart Routing logic)
CREATE TABLE IF NOT EXISTS public.provider_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES public.providers(id),
    order_id UUID REFERENCES public.orders(id),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Initial seed with current primary provider (TxtConnect example)
-- Note: In a real scenario, the admin would fill this via UI, but we add a placeholder.
INSERT INTO public.providers (name, provider_type, is_active, priority)
VALUES ('TxtConnect (Main)', 'data', true, 1)
ON CONFLICT (name) DO NOTHING;
