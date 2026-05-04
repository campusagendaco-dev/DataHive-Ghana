-- Create menu_banners table
CREATE TABLE IF NOT EXISTS public.menu_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    target_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies
ALTER TABLE public.menu_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Access for Menu Banners" ON public.menu_banners;
CREATE POLICY "Public Read Access for Menu Banners" ON public.menu_banners
    FOR SELECT TO public USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admin Manage Menu Banners" ON public.menu_banners;
CREATE POLICY "Admin Manage Menu Banners" ON public.menu_banners
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket is already created as 'promo-banners', we can reuse it
