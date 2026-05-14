-- Add welcome_promo_enabled toggle to system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS welcome_promo_enabled BOOLEAN DEFAULT true;
