-- Create a new free data promo code for testing
INSERT INTO public.promo_codes (code, discount_percentage, max_uses, current_uses, is_active)
VALUES ('SWIFTDATA', 100.00, 1000, 0, true)
ON CONFLICT (code) DO UPDATE 
SET max_uses = 1000, current_uses = 0, is_active = true, discount_percentage = 100.00;

-- Also delete previous claims for this code if they exist to allow re-testing
DELETE FROM public.promo_claims 
WHERE promo_code_id IN (SELECT id FROM public.promo_codes WHERE code = 'SWIFTDATA');
