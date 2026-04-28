-- ADD ADMIN NOTES TO PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- ADD SYSTEM ANNOUNCEMENT SETTINGS IF MISSING (Double Check)
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS show_announcement BOOLEAN DEFAULT FALSE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS announcement_title TEXT DEFAULT 'Welcome to SwiftPoints!';
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS announcement_message TEXT DEFAULT 'You now earn rewards for every purchase. 100 points = GHS 1.00 cash back!';
