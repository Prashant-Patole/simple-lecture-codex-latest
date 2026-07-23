-- Create temp-uploads bucket for intermediary file storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-uploads',
  'temp-uploads',
  false,
  104857600, -- 100MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: authenticated users can upload their own files
CREATE POLICY "Authenticated users can upload temp files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'temp-uploads');

-- RLS policy: authenticated users can read their own temp files
CREATE POLICY "Authenticated users can read temp files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'temp-uploads');

-- RLS policy: service role can delete temp files (for cleanup)
CREATE POLICY "Service role can delete temp files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'temp-uploads');