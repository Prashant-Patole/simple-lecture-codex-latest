-- Create teaching Q&A cache table for storing AI responses
CREATE TABLE public.teaching_qa_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.subject_topics(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.subject_chapters(id) ON DELETE CASCADE,
  question_hash TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_html TEXT,
  presentation_slides JSONB DEFAULT '[]'::jsonb,
  latex_formulas JSONB DEFAULT '[]'::jsonb,
  diagrams_urls JSONB DEFAULT '[]'::jsonb,
  audio_narration_url TEXT,
  language TEXT DEFAULT 'en-IN',
  usage_count INTEGER DEFAULT 1,
  avg_satisfaction NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index for cache lookup
CREATE UNIQUE INDEX idx_teaching_qa_cache_lookup 
ON public.teaching_qa_cache(topic_id, question_hash, language) 
WHERE topic_id IS NOT NULL;

CREATE UNIQUE INDEX idx_teaching_qa_cache_chapter_lookup 
ON public.teaching_qa_cache(chapter_id, question_hash, language) 
WHERE chapter_id IS NOT NULL;

-- Create index for question hash lookup
CREATE INDEX idx_teaching_qa_cache_hash ON public.teaching_qa_cache(question_hash);

-- Enable RLS
ALTER TABLE public.teaching_qa_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access for cached Q&A
CREATE POLICY "Anyone can read cached Q&A" 
ON public.teaching_qa_cache 
FOR SELECT 
USING (true);

-- Allow authenticated users to insert cache entries
CREATE POLICY "Authenticated users can insert cache" 
ON public.teaching_qa_cache 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow updates to increment usage count
CREATE POLICY "Allow usage count updates" 
ON public.teaching_qa_cache 
FOR UPDATE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_teaching_qa_cache_updated_at
BEFORE UPDATE ON public.teaching_qa_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();