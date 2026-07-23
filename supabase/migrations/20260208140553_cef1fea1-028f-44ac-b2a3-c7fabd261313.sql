-- Create subject_thumbnails table (similar pattern to course_thumbnails)
CREATE TABLE IF NOT EXISTS public.subject_thumbnails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subject_id)
);

-- Index for fast lookups
CREATE INDEX idx_subject_thumbnails_subject_id ON public.subject_thumbnails(subject_id);

-- Enable RLS
ALTER TABLE public.subject_thumbnails ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated read
CREATE POLICY "Authenticated users can read subject thumbnails"
  ON public.subject_thumbnails FOR SELECT
  TO authenticated
  USING (true);

-- Policy for service role write (admin operations)
CREATE POLICY "Service role can manage subject thumbnails"
  ON public.subject_thumbnails FOR ALL
  TO service_role
  USING (true);

-- Policy for anon read (public subjects need thumbnails)
CREATE POLICY "Public can read subject thumbnails"
  ON public.subject_thumbnails FOR SELECT
  TO anon
  USING (true);