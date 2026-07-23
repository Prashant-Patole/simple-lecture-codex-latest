-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public)
VALUES ('questions-images', 'questions-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload question images
CREATE POLICY "Authenticated users can upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'questions-images');

-- Allow public read access for question images
CREATE POLICY "Public read access for question images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'questions-images');

-- Allow authenticated users to update their uploaded images
CREATE POLICY "Authenticated users can update question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'questions-images');

-- Allow authenticated users to delete question images
CREATE POLICY "Authenticated users can delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'questions-images');