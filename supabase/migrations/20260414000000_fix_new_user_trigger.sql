-- Fix new user creation: ensure topup_reference column, generate function, and triggers exist
-- This migration is idempotent and safe to run on any database state.

-- 1. Add topup_reference column to profiles if it does not already exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS topup_reference TEXT UNIQUE;

-- 2. Create or replace the topup reference generator trigger function
CREATE OR REPLACE FUNCTION public.generate_topup_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.topup_reference IS NULL THEN
    LOOP
      ref := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE topup_reference = ref);
      attempts := attempts + 1;
      IF attempts > 100 THEN
        RAISE EXCEPTION 'Could not generate unique topup reference';
      END IF;
    END LOOP;
    NEW.topup_reference := ref;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Recreate the BEFORE INSERT trigger on profiles
DROP TRIGGER IF EXISTS set_topup_reference ON public.profiles;
CREATE TRIGGER set_topup_reference
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_topup_reference();

-- 4. Replace handle_new_user with latest version (also fires the trigger above)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

-- 5. Ensure the auth trigger exists (recreate safely)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
