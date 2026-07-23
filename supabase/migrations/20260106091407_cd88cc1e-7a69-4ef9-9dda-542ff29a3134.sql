-- Create table to track attempted DPP questions per student
CREATE TABLE public.dpp_attempted_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.dpp_questions(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.subject_topics(id) ON DELETE SET NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  was_correct BOOLEAN,
  UNIQUE(student_id, question_id)
);

-- Index for fast lookups
CREATE INDEX idx_dpp_attempted_student_topic ON public.dpp_attempted_questions(student_id, topic_id);

-- Enable RLS
ALTER TABLE public.dpp_attempted_questions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own attempted questions"
  ON public.dpp_attempted_questions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Users can insert own attempted questions"
  ON public.dpp_attempted_questions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can update own attempted questions"
  ON public.dpp_attempted_questions FOR UPDATE
  USING (auth.uid() = student_id);