-- Create table for topic-level DPP submissions
CREATE TABLE public.dpp_topic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dpp_type TEXT NOT NULL CHECK (dpp_type IN ('teacher', 'ai_generated')),
  questions JSONB NOT NULL,
  answers JSONB NOT NULL,
  score INTEGER,
  total_questions INTEGER DEFAULT 10,
  time_taken_seconds INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, topic_id, test_date)
);

-- Enable RLS
ALTER TABLE public.dpp_topic_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view own dpp submissions"
  ON public.dpp_topic_submissions
  FOR SELECT
  USING (auth.uid() = student_id);

-- Users can insert their own submissions
CREATE POLICY "Users can insert own dpp submissions"
  ON public.dpp_topic_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Create index for faster lookups
CREATE INDEX idx_dpp_topic_submissions_student_topic_date 
  ON public.dpp_topic_submissions(student_id, topic_id, test_date);