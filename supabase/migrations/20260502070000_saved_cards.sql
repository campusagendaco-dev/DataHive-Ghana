-- SAVED CARDS: Store Paystack customer code and recurring authorizations
-- This enables "Saved Cards" and "One-Click Checkout" features.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paystack_saved_authorizations JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.paystack_customer_code IS 'The unique Paystack customer code (CUS_...) for this user.';
COMMENT ON COLUMN public.profiles.paystack_saved_authorizations IS 'Array of reusable authorization objects from Paystack (Saved Cards).';
