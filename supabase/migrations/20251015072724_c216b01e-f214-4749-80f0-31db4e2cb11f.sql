-- Phase 1: Database Schema for Enhanced Subject Management

-- 1. Subject-Category Mapping Table
CREATE TABLE IF NOT EXISTS public.subject_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, category_id)
);

-- Enable RLS on subject_categories
ALTER TABLE public.subject_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_categories
CREATE POLICY "Admins manage subject categories"
  ON public.subject_categories
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view subject categories"
  ON public.subject_categories
  FOR SELECT
  USING (true);

-- 2. Subject Chapters Table
CREATE TABLE IF NOT EXISTS public.subject_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, chapter_number)
);

-- Enable RLS on subject_chapters
ALTER TABLE public.subject_chapters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_chapters
CREATE POLICY "Admins manage subject chapters"
  ON public.subject_chapters
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view subject chapters"
  ON public.subject_chapters
  FOR SELECT
  USING (true);

-- 3. Subject Topics Table
CREATE TABLE IF NOT EXISTS public.subject_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.subject_chapters(id) ON DELETE CASCADE,
  topic_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  estimated_duration_minutes INTEGER,
  video_url TEXT,
  content_markdown TEXT,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, topic_number)
);

-- Enable RLS on subject_topics
ALTER TABLE public.subject_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_topics
CREATE POLICY "Admins manage subject topics"
  ON public.subject_topics
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view subject topics"
  ON public.subject_topics
  FOR SELECT
  USING (true);

-- 4. Previous Year Papers Table
CREATE TABLE IF NOT EXISTS public.subject_previous_year_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  exam_name TEXT NOT NULL,
  paper_type TEXT,
  pdf_url TEXT,
  total_questions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, year, exam_name, paper_type)
);

-- Enable RLS on subject_previous_year_papers
ALTER TABLE public.subject_previous_year_papers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_previous_year_papers
CREATE POLICY "Admins manage previous year papers"
  ON public.subject_previous_year_papers
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view previous year papers"
  ON public.subject_previous_year_papers
  FOR SELECT
  USING (true);

-- 5. Enhance Questions Table
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS question_image_url TEXT,
  ADD COLUMN IF NOT EXISTS option_images JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contains_formula BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS formula_type TEXT,
  ADD COLUMN IF NOT EXISTS previous_year_paper_id UUID REFERENCES public.subject_previous_year_papers(id) ON DELETE SET NULL;

-- 6. Add Triggers for updated_at
CREATE TRIGGER update_subject_chapters_updated_at
  BEFORE UPDATE ON public.subject_chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subject_topics_updated_at
  BEFORE UPDATE ON public.subject_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 6: Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('question-images', 'question-images', true),
  ('chapter-pdfs', 'chapter-pdfs', true),
  ('previous-year-papers', 'previous-year-papers', true),
  ('excel-templates', 'excel-templates', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage Buckets
CREATE POLICY "Anyone can view question images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

CREATE POLICY "Admins can upload question images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete question images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view chapter PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-pdfs');

CREATE POLICY "Admins can upload chapter PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chapter-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view previous year papers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'previous-year-papers');

CREATE POLICY "Admins can upload previous year papers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'previous-year-papers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view excel templates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'excel-templates');

CREATE POLICY "Admins can upload excel templates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'excel-templates' AND public.has_role(auth.uid(), 'admin'::app_role));