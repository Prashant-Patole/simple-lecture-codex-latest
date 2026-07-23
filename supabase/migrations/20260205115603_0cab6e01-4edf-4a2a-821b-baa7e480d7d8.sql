-- Create storage bucket for category icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-icons', 'category-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Category icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-icons');

-- Allow authenticated users to upload (admin will be checked in edge function)
CREATE POLICY "Authenticated users can upload category icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'category-icons' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update category icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'category-icons' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads  
CREATE POLICY "Authenticated users can delete category icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'category-icons' AND auth.role() = 'authenticated');