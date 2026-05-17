-- Migration: Auto-create native wallets for new users on signup
-- Description: Updates the handle_new_user trigger function to atomically initialize a native wallet when a user signs up.
-- Also runs a backfill to ensure any existing profiles without wallets are immediately initialized.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Insert user profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  );

  -- 2. Atomically insert native wallet for the new user
  INSERT INTO public.wallets (agent_id, balance, loyalty_balance, api_balance, created_at, updated_at)
  VALUES (NEW.id, 0.00, 0, 0.00, NOW(), NOW())
  ON CONFLICT (agent_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Self-healing backfill: Ensure any existing users without a wallet get one created right now
INSERT INTO public.wallets (agent_id, balance, loyalty_balance, api_balance, created_at, updated_at)
SELECT 
    p.user_id, 
    0.00, 
    0, 
    0.00, 
    NOW(), 
    NOW()
FROM public.profiles p
LEFT JOIN public.wallets w ON p.user_id = w.agent_id
WHERE w.agent_id IS NULL
ON CONFLICT (agent_id) DO NOTHING;
