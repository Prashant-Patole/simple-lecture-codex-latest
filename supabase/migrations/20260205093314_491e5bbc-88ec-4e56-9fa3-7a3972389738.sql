-- Create storage bucket for course thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true);

-- Create course_thumbnails table
CREATE TABLE public.course_thumbnails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id)
);

-- Auto-update timestamp trigger
CREATE TRIGGER update_course_thumbnails_updated_at
  BEFORE UPDATE ON public.course_thumbnails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.course_thumbnails ENABLE ROW LEVEL SECURITY;

-- Public read access (thumbnails are public)
CREATE POLICY "Anyone can view course thumbnails"
  ON public.course_thumbnails FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write access
CREATE POLICY "Admins can manage course thumbnails"
  ON public.course_thumbnails FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Storage RLS Policies
-- Allow public read access to course thumbnails
CREATE POLICY "Public can view course thumbnails"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'course-thumbnails');

-- Allow authenticated admins to upload thumbnails
CREATE POLICY "Admins can upload course thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-thumbnails'
    AND has_role(auth.uid(), 'admin')
  );

-- Allow authenticated admins to update thumbnails
CREATE POLICY "Admins can update course thumbnails"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-thumbnails'
    AND has_role(auth.uid(), 'admin')
  );

-- Allow authenticated admins to delete thumbnails
CREATE POLICY "Admins can delete course thumbnails"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-thumbnails'
    AND has_role(auth.uid(), 'admin')
  );