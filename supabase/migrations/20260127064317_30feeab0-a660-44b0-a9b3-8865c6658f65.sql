-- Create dedicated test_results table for tests from the 'tests' table
-- This resolves the FK constraint error when submitting proficiency/mock/exam tests

CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.popular_subjects(id),
  test_type TEXT NOT NULL DEFAULT 'proficiency',
  score INTEGER,
  total_questions INTEGER NOT NULL,
  percentage NUMERIC(5,2),
  time_taken_seconds INTEGER,
  answers JSONB DEFAULT '{}',
  grading_status TEXT DEFAULT 'graded',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view their own test results"
ON public.test_results FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own test results"
ON public.test_results FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own test results"
ON public.test_results FOR UPDATE
USING (auth.uid() = student_id);

-- Index for faster queries
CREATE INDEX idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX idx_test_results_test_id ON public.test_results(test_id);
CREATE INDEX idx_test_results_submitted_at ON public.test_results(submitted_at DESC);