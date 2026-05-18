-- 20260518030000_enable_whitelabel_reseller_stores.sql
-- Prepare database for complete Whitelabel Reseller Stores & Custom Domain hosting.

-- 1. Extend public.profiles table with whitelabel details
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_domain      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS domain_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS store_owner_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_banner_url   TEXT,
  ADD COLUMN IF NOT EXISTS store_description  TEXT;

-- 2. Create index on custom_domain for fast hostname-based lookup
CREATE INDEX IF NOT EXISTS idx_profiles_custom_domain ON public.profiles(custom_domain) WHERE custom_domain IS NOT NULL;

-- 3. Extend public.orders table with cost_price to track platform wholesale cost at execution time
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0;

-- 4. Recreate public.agent_stores view (enforced with security_invoker = true)
DROP VIEW IF EXISTS public.agent_stores CASCADE;

CREATE VIEW public.agent_stores WITH (security_invoker = true) AS
SELECT 
    user_id,
    full_name,
    store_name,
    whatsapp_number,
    support_number,
    whatsapp_group_link,
    agent_prices,
    sub_agent_prices,
    disabled_packages,
    is_agent,
    is_sub_agent,
    agent_approved,
    sub_agent_approved,
    parent_agent_id,
    sub_agent_activation_markup,
    store_logo_url,
    store_primary_color,
    store_banner_url,
    store_description,
    slug,
    custom_domain,
    domain_verified,
    email
FROM public.profiles
WHERE (is_agent = true OR is_sub_agent = true)
  AND onboarding_complete = true;

GRANT SELECT ON public.agent_stores TO anon, authenticated;
