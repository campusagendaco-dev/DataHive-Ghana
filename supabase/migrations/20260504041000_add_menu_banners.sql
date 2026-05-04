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

-- Enable RLS
ALTER TABLE public.menu_banners ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public Read Access for Menu Banners" ON public.menu_banners
    FOR SELECT TO public USING (is_active = TRUE);

CREATE POLICY "Admin Manage Menu Banners" ON public.menu_banners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Storage bucket is already created as 'promo-banners', we can reuse it
