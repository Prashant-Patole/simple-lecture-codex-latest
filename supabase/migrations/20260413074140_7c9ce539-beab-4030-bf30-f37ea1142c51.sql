
-- Badge types enum
CREATE TYPE public.badge_type AS ENUM ('silver', 'bronze', 'gold', 'master', 'course_complete');

-- Student badges table
CREATE TABLE public.student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type public.badge_type NOT NULL,
  topic_id UUID REFERENCES public.subject_topics(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.subject_chapters(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraints (using partial indexes to handle NULLs properly)
CREATE UNIQUE INDEX idx_student_badge_topic 
  ON public.student_badges(student_id, badge_type, topic_id) 
  WHERE topic_id IS NOT NULL;

CREATE UNIQUE INDEX idx_student_badge_chapter 
  ON public.student_badges(student_id, badge_type, chapter_id) 
  WHERE chapter_id IS NOT NULL;

CREATE UNIQUE INDEX idx_student_badge_subject 
  ON public.student_badges(student_id, badge_type, subject_id) 
  WHERE subject_id IS NOT NULL;

CREATE UNIQUE INDEX idx_student_badge_course 
  ON public.student_badges(student_id, badge_type, course_id) 
  WHERE course_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- Students can read their own badges
CREATE POLICY "Students can read own badges"
  ON public.student_badges
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());
