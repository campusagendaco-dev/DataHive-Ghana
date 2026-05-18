-- 20260518050000_unlimited_reseller_stores.sql
-- Upgrades the database to support unlimited whitelabel storefronts per reseller agent

-- 1. Create the reseller_stores table
CREATE TABLE IF NOT EXISTS public.reseller_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  store_logo_url TEXT,
  store_banner_url TEXT,
  store_description TEXT,
  store_primary_color TEXT DEFAULT '#fbbf24',
  custom_domain TEXT UNIQUE,
  domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create performance lookup indexes
CREATE INDEX IF NOT EXISTS idx_reseller_stores_user_id ON public.reseller_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_reseller_stores_slug ON public.reseller_stores(slug);
CREATE INDEX IF NOT EXISTS idx_reseller_stores_custom_domain ON public.reseller_stores(custom_domain);

-- 3. Perform a high-availability migration of existing store setups
INSERT INTO public.reseller_stores (
  user_id, store_name, slug, store_logo_url, store_primary_color, 
  custom_domain, domain_verified, store_banner_url, store_description
)
SELECT 
  user_id, store_name, slug, store_logo_url, store_primary_color, 
  custom_domain, domain_verified, store_banner_url, store_description
FROM public.profiles
WHERE store_name IS NOT NULL AND slug IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- 4. Drop and Redefine public.agent_stores view as a joined entity
DROP VIEW IF EXISTS public.agent_stores CASCADE;

CREATE VIEW public.agent_stores WITH (security_invoker = true) AS
SELECT 
  s.id AS store_id,
  s.user_id,
  s.store_name,
  s.slug,
  p.momo_number,
  p.momo_network,
  p.momo_account_name,
  s.store_logo_url,
  s.store_primary_color,
  p.whatsapp_number,
  p.support_number,
  p.whatsapp_group_link,
  p.email,
  s.custom_domain,
  s.domain_verified,
  s.store_banner_url,
  s.store_description,
  s.created_at,
  s.updated_at
FROM public.reseller_stores s
LEFT JOIN public.profiles p ON s.user_id = p.user_id;

GRANT SELECT ON public.agent_stores TO anon, authenticated;

-- 5. Set up Row Level Security (RLS) policies
ALTER TABLE public.reseller_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for reseller stores" ON public.reseller_stores;
CREATE POLICY "Allow public select for reseller stores" 
  ON public.reseller_stores FOR SELECT 
  TO anon, authenticated 
  USING (true);

DROP POLICY IF EXISTS "Allow owner actions for reseller stores" ON public.reseller_stores;
CREATE POLICY "Allow owner actions for reseller stores" 
  ON public.reseller_stores FOR ALL 
  TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());
