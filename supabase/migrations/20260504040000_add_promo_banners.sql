-- Create promo_banners table
CREATE TABLE IF NOT EXISTS public.promo_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_type TEXT DEFAULT 'image', -- 'image' or 'text'
    image_url TEXT, -- required if type is image
    content TEXT,   -- required if type is text
    background_color TEXT DEFAULT '#f59e0b', -- for text banners
    text_color TEXT DEFAULT '#000000',      -- for text banners
    target_url TEXT,
    title TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

-- Public can view active banners
CREATE POLICY "Public can view active banners" ON public.promo_banners
    FOR SELECT USING (is_active = TRUE);

-- Admins can do everything
CREATE POLICY "Admins can manage promo banners" ON public.promo_banners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create storage bucket for promo banners if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for promo banners
-- Allow public to read
CREATE POLICY "Public Read Access" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'promo-banners');

-- Allow admins to upload/manage
CREATE POLICY "Admin Manage Banners" ON storage.objects
    FOR ALL TO authenticated USING (
        bucket_id = 'promo-banners' AND (
            EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = auth.uid() AND role = 'admin'
            )
        )
    );
