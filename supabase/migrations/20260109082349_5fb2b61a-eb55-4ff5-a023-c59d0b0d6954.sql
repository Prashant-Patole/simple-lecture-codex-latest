-- Create storage bucket for class recordings if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('class-recordings', 'class-recordings', false, 10737418240)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
-- Allow authenticated users to upload recordings (admins will be checked in app)
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'class-recordings');

-- Allow authenticated users to view recordings they have access to
CREATE POLICY "Authenticated users can view recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'class-recordings');

-- Allow authenticated users to delete recordings (admins will be checked in app)
CREATE POLICY "Authenticated users can delete recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'class-recordings');