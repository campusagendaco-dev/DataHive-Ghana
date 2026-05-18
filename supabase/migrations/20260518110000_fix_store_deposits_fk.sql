-- 20260518110000_fix_store_deposits_fk.sql
-- Fixes the foreign key references on store_deposits to point to public.profiles
-- instead of auth.users, so PostgREST can resolve the relationship for joined queries.

-- Drop old auth.users FK constraints
ALTER TABLE public.store_deposits
  DROP CONSTRAINT IF EXISTS store_deposits_agent_id_fkey,
  DROP CONSTRAINT IF EXISTS store_deposits_customer_id_fkey;

-- Re-add FKs pointing to public.profiles.user_id (PostgREST-visible)
ALTER TABLE public.store_deposits
  ADD CONSTRAINT store_deposits_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  ADD CONSTRAINT store_deposits_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
