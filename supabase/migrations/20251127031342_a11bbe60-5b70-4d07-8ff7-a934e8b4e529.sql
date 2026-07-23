-- Create storage_files table to track all uploaded files in Backblaze B2
CREATE TABLE IF NOT EXISTS public.storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  b2_file_id TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('chapter', 'topic', 'subtopic', 'previous_year_paper')),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.subject_chapters(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.subject_topics(id) ON DELETE CASCADE,
  subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE CASCADE,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_storage_files_path ON public.storage_files(file_path);
CREATE INDEX IF NOT EXISTS idx_storage_files_entity ON public.storage_files(entity_type, category_id, subject_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_storage_files_uploaded_by ON public.storage_files(uploaded_by);

-- Enable RLS
ALTER TABLE public.storage_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins manage all files"
  ON public.storage_files
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers manage files for their subjects"
  ON public.storage_files
  FOR ALL
  USING (
    has_role(auth.uid(), 'teacher'::app_role) 
    AND subject_id IN (
      SELECT subject_id FROM instructor_subjects WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view files"
  ON public.storage_files
  FOR SELECT
  USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_storage_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_files_updated_at
  BEFORE UPDATE ON public.storage_files
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_files_updated_at();