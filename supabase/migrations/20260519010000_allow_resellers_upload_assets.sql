-- 20260519010000_allow_resellers_upload_assets.sql
-- Allow authenticated reseller agents to upload their custom logos and banners to the site-assets storage bucket.

-- 1. Drop existing policies if they conflict
DROP POLICY IF EXISTS "Agents can upload own store assets" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update own store assets" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete own store assets" ON storage.objects;

-- 2. Create the INSERT policy
CREATE POLICY "Agents can upload own store assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-assets' AND
  (
    -- Either they are an admin
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    OR
    -- Or it's a store asset with their user_id prefix in the path
    (
      (position('store-logos/' in name) = 1 OR position('store-banners/' in name) = 1) AND 
      split_part(name, '/', 2) LIKE (auth.uid()::text || '%')
    )
  )
);

-- 3. Create the UPDATE policy
CREATE POLICY "Agents can update own store assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-assets' AND
  (
    -- Either they are an admin
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    OR
    -- Or it's a store asset with their user_id prefix in the path
    (
      (position('store-logos/' in name) = 1 OR position('store-banners/' in name) = 1) AND 
      split_part(name, '/', 2) LIKE (auth.uid()::text || '%')
    )
  )
);

-- 4. Create the DELETE policy
CREATE POLICY "Agents can delete own store assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-assets' AND
  (
    -- Either they are an admin
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    OR
    -- Or it's a store asset with their user_id prefix in the path
    (
      (position('store-logos/' in name) = 1 OR position('store-banners/' in name) = 1) AND 
      split_part(name, '/', 2) LIKE (auth.uid()::text || '%')
    )
  )
);
