-- Create dpp_documents table to track uploaded DPP files
CREATE TABLE public.dpp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES popular_subjects(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES subject_chapters(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES subject_topics(id) ON DELETE SET NULL,
  display_name TEXT,
  questions_file_url TEXT,
  solutions_file_url TEXT,
  questions_mmd TEXT,
  solutions_mmd TEXT,
  status TEXT DEFAULT 'pending',
  questions_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create dpp_questions table to store extracted DPP questions
CREATE TABLE public.dpp_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES dpp_documents(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES popular_subjects(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES subject_chapters(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES subject_topics(id) ON DELETE SET NULL,
  dpp_number INTEGER,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX idx_dpp_questions_topic ON dpp_questions(topic_id);
CREATE INDEX idx_dpp_questions_subject ON dpp_questions(subject_id);
CREATE INDEX idx_dpp_questions_chapter ON dpp_questions(chapter_id);
CREATE INDEX idx_dpp_questions_document ON dpp_questions(document_id);
CREATE INDEX idx_dpp_documents_subject ON dpp_documents(subject_id);

-- Enable RLS
ALTER TABLE public.dpp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpp_questions ENABLE ROW LEVEL SECURITY;

-- RLS policies for dpp_documents
CREATE POLICY "Anyone can view dpp_documents" ON public.dpp_documents
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert dpp_documents" ON public.dpp_documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update dpp_documents" ON public.dpp_documents
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete dpp_documents" ON public.dpp_documents
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for dpp_questions
CREATE POLICY "Anyone can view dpp_questions" ON public.dpp_questions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert dpp_questions" ON public.dpp_questions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update dpp_questions" ON public.dpp_questions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete dpp_questions" ON public.dpp_questions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_dpp_documents_updated_at
  BEFORE UPDATE ON public.dpp_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dpp_questions_updated_at
  BEFORE UPDATE ON public.dpp_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();