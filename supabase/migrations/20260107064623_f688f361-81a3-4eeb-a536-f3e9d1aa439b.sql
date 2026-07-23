-- Add columns to store audio URLs and key points for replay
ALTER TABLE teaching_qa_cache 
ADD COLUMN IF NOT EXISTS slide_audio_urls JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS key_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS total_duration_seconds NUMERIC DEFAULT 0;

-- Create storage bucket for presentation audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation-audio', 'presentation-audio', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for public read access
CREATE POLICY "Public read access for presentation audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'presentation-audio');

-- Allow authenticated users to upload audio
CREATE POLICY "Authenticated users can upload presentation audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'presentation-audio');

-- Allow users to update their own audio files
CREATE POLICY "Users can update presentation audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'presentation-audio');

-- Allow users to delete their own audio files
CREATE POLICY "Users can delete presentation audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'presentation-audio');