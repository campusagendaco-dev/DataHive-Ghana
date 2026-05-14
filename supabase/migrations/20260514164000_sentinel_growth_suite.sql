-- Sentinel Growth & Loyalty Suite
-- Enables autonomous marketing, dynamic pricing, and VIP tiering

-- 1. Marketing Promos (AI Generated)
CREATE TABLE IF NOT EXISTS public.sentinel_marketing_promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    discount_percent NUMERIC,
    expires_at TIMESTAMPTZ,
    target_user_id UUID REFERENCES auth.users(id),
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Price Intelligence (Competitor/Market Tracking)
CREATE TABLE IF NOT EXISTS public.sentinel_price_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network TEXT,
    package_size TEXT,
    market_avg_price NUMERIC,
    our_current_price NUMERIC,
    suggested_price NUMERIC,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- 3. Agent Health & Loyalty Scores
CREATE TABLE IF NOT EXISTS public.agent_loyalty_metrics (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    monthly_volume NUMERIC DEFAULT 0,
    days_since_last_order INTEGER DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'Standard' CHECK (loyalty_tier IN ('Standard', 'Bronze', 'Silver', 'Gold', 'VIP')),
    last_evaluation TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sentinel_marketing_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_price_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_loyalty_metrics ENABLE ROW LEVEL SECURITY;

-- Admins only
CREATE POLICY "Admins can manage growth suite" 
ON public.sentinel_marketing_promos FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT is_admin FROM profiles WHERE user_id = auth.uid()));

-- Realtime for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE sentinel_marketing_promos;
ALTER PUBLICATION supabase_realtime ADD TABLE sentinel_price_intelligence;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_loyalty_metrics;
