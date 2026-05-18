-- ================================================================
-- RESTORE RELATIONSHIP SCHEMA FOR WALLETS AND PROFILES
-- Fixes HTTP 400 in AdminSwiftVendorPro select query
-- ================================================================

-- 1. Remove any orphaned test wallets that do not have a matching user profile
DELETE FROM public.wallets 
WHERE agent_id NOT IN (SELECT user_id FROM public.profiles);

-- 2. Add foreign key constraint to formalize the relation for PostgREST joins
ALTER TABLE public.wallets
DROP CONSTRAINT IF EXISTS fk_wallets_agent_id;

ALTER TABLE public.wallets
ADD CONSTRAINT fk_wallets_agent_id
FOREIGN KEY (agent_id)
REFERENCES public.profiles(user_id)
ON DELETE CASCADE;
