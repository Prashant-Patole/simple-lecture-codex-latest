-- Add avatar_url column to forum_groups
ALTER TABLE forum_groups 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN forum_groups.avatar_url IS 'URL to group profile image stored in storage';

-- Create the group-avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-avatars', 'group-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload group avatars
CREATE POLICY "Authenticated users can upload group avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-avatars');

-- Allow anyone to view group avatars
CREATE POLICY "Anyone can view group avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-avatars');

-- Allow authenticated users to update their uploaded avatars
CREATE POLICY "Authenticated users can update group avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'group-avatars');

-- Allow authenticated users to delete group avatars
CREATE POLICY "Authenticated users can delete group avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-avatars');