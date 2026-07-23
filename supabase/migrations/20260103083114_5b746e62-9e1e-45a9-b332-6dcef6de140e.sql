-- Create paper_test_results table to store all test submissions
CREATE TABLE public.paper_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  paper_id UUID NOT NULL REFERENCES public.subject_previous_year_papers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE SET NULL,
  paper_category TEXT NOT NULL CHECK (paper_category IN ('previous_year', 'proficiency', 'exam')),
  score INTEGER,
  total_questions INTEGER NOT NULL,
  percentage NUMERIC(5,2),
  time_taken_seconds INTEGER,
  answers JSONB DEFAULT '{}',
  grading_status TEXT DEFAULT 'pending' CHECK (grading_status IN ('pending', 'graded', 'ai_graded')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paper_test_results ENABLE ROW LEVEL SECURITY;

-- Students can view their own results
CREATE POLICY "Students view own results"
ON public.paper_test_results
FOR SELECT
USING (auth.uid() = student_id);

-- Students can insert their own results
CREATE POLICY "Students insert own results"
ON public.paper_test_results
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Students can update their own results (for AI grading updates)
CREATE POLICY "Students update own results"
ON public.paper_test_results
FOR UPDATE
USING (auth.uid() = student_id);

-- Admins can manage all results
CREATE POLICY "Admins manage all results"
ON public.paper_test_results
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_paper_test_results_student_id ON public.paper_test_results(student_id);
CREATE INDEX idx_paper_test_results_paper_id ON public.paper_test_results(paper_id);
CREATE INDEX idx_paper_test_results_subject_id ON public.paper_test_results(subject_id);