-- 20260519000000_add_in_app_domain_purchases.sql
-- Enables in-app custom domain purchase capabilities for whitelabel reseller stores

-- 1. Create the domain_pricing table
CREATE TABLE IF NOT EXISTS public.domain_pricing (
  tld TEXT PRIMARY KEY,
  cost_price_usd DECIMAL NOT NULL,
  sale_price_ghs DECIMAL NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed domain options and pricing in GHS
INSERT INTO public.domain_pricing (tld, cost_price_usd, sale_price_ghs) VALUES
('.com', 10.99, 150.00),
('.net', 12.99, 180.00),
('.org', 13.99, 195.00),
('.shop', 3.99, 70.00),
('.xyz', 1.99, 45.00)
ON CONFLICT (tld) DO UPDATE SET 
  cost_price_usd = EXCLUDED.cost_price_usd,
  sale_price_ghs = EXCLUDED.sale_price_ghs;

-- 3. Create domain_purchases logs table
CREATE TABLE IF NOT EXISTS public.domain_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.reseller_stores(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE,
  tld TEXT NOT NULL REFERENCES public.domain_pricing(tld),
  amount_paid DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed')),
  registrar_order_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create performance lookup indices
CREATE INDEX IF NOT EXISTS idx_domain_purchases_user_id ON public.domain_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_purchases_store_id ON public.domain_purchases(store_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.domain_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_purchases ENABLE ROW LEVEL SECURITY;

-- 5. Set up RLS Policies
DROP POLICY IF EXISTS "Anyone can read domain pricing" ON public.domain_pricing;
CREATE POLICY "Anyone can read domain pricing" 
  ON public.domain_pricing FOR SELECT 
  TO anon, authenticated 
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Resellers can read own domain purchases" ON public.domain_purchases;
CREATE POLICY "Resellers can read own domain purchases" 
  ON public.domain_purchases FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Resellers can insert own domain purchases" ON public.domain_purchases;
CREATE POLICY "Resellers can insert own domain purchases" 
  ON public.domain_purchases FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- 6. Grant Permissions
GRANT SELECT ON public.domain_pricing TO anon, authenticated;
GRANT SELECT, INSERT ON public.domain_purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_purchases TO service_role;
