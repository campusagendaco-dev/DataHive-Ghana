-- Add terminal locking capabilities and SMS templates

-- 1. Add terminal_locked to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS terminal_locked BOOLEAN DEFAULT false;

-- 2. Add SMS templates to system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS terminal_locked_sms_message TEXT DEFAULT 'SECURITY ALERT: Your Swift Vendor terminal has been LOCKED by the administrator. Please contact support immediately.';

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS terminal_unlocked_sms_message TEXT DEFAULT 'SECURITY UPDATE: Your Swift Vendor terminal has been UNLOCKED. You can now resume transactions. Thank you for your patience.';

-- 3. Update AI Strategy Hub view (optional but good for consistency)
COMMENT ON COLUMN public.profiles.terminal_locked IS 'Indicates if the vendor terminal is remotely frozen by an admin.';
