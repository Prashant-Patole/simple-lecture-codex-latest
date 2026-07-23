-- Add document_type column to subject_previous_year_papers
ALTER TABLE subject_previous_year_papers 
ADD COLUMN document_type TEXT DEFAULT 'mcq' 
CHECK (document_type IN ('mcq', 'practice', 'proficiency'));

-- Create student_answers table for storing written answers
CREATE TABLE student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES subject_previous_year_papers(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_image_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on student_answers
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_answers
CREATE POLICY "Students can view own answers"
ON student_answers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own answers"
ON student_answers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own answers"
ON student_answers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all answers"
ON student_answers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for student answer images
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-answers', 'student-answers', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for student-answers bucket
CREATE POLICY "Students can upload own answer images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'student-answers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students can view own answer images"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-answers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all answer images"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-answers' AND has_role(auth.uid(), 'admin'::app_role));