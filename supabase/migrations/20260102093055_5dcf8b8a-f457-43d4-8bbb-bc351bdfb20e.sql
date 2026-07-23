-- Create storage bucket for extracted PDF images
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-images', 'pdf-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload pdf images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdf-images');

-- Allow public read access to pdf images
CREATE POLICY "Public read access for pdf images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete pdf images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdf-images');