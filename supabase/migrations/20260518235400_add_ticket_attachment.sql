-- ================================================================
-- ADD ATTACHMENT TO SUPPORT TICKETS
-- Allows users to upload screenshots of failed transactions
-- ================================================================

-- 1. Add column to support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Create support-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage RLS Policies for support-attachments
DROP POLICY IF EXISTS "Public Read Support Attachments" ON storage.objects;
CREATE POLICY "Public Read Support Attachments" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "Authenticated Upload Support Attachments" ON storage.objects;
CREATE POLICY "Authenticated Upload Support Attachments" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "Owner Manage Support Attachments" ON storage.objects;
CREATE POLICY "Owner Manage Support Attachments" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'support-attachments' AND auth.uid() = owner);
