-- Create course_faqs table
CREATE TABLE IF NOT EXISTS public.course_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create course_subjects table
CREATE TABLE IF NOT EXISTS public.course_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(course_id, subject_id)
);

-- Add new columns to courses table
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS detailed_description TEXT,
ADD COLUMN IF NOT EXISTS what_you_learn JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS course_includes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS instructor_name TEXT,
ADD COLUMN IF NOT EXISTS instructor_bio TEXT,
ADD COLUMN IF NOT EXISTS instructor_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_months INTEGER,
ADD COLUMN IF NOT EXISTS price_inr INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_price_inr INTEGER;

-- Enable RLS on new tables
ALTER TABLE public.course_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_subjects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_faqs
CREATE POLICY "Anyone can view course FAQs"
ON public.course_faqs FOR SELECT
USING (true);

CREATE POLICY "Admins manage course FAQs"
ON public.course_faqs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for course_subjects
CREATE POLICY "Anyone can view course subjects"
ON public.course_subjects FOR SELECT
USING (true);

CREATE POLICY "Admins manage course subjects"
ON public.course_subjects FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage courses
CREATE POLICY "Admins can manage courses"
ON public.courses FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_faqs_course_id ON public.course_faqs(course_id);
CREATE INDEX IF NOT EXISTS idx_course_subjects_course_id ON public.course_subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_course_subjects_subject_id ON public.course_subjects(subject_id);

-- Trigger for updated_at on course_faqs
CREATE TRIGGER update_course_faqs_updated_at
BEFORE UPDATE ON public.course_faqs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();