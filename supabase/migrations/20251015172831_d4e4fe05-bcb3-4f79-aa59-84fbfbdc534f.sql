-- Phase 3: Add subject_id column to course_instructors table
-- This allows instructors to be assigned per subject within a course

ALTER TABLE public.course_instructors 
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.popular_subjects(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_course_instructors_subject_id ON public.course_instructors(subject_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_course_subject ON public.course_instructors(course_id, subject_id);

COMMENT ON COLUMN public.course_instructors.subject_id IS 'Links instructor assignment to a specific subject within the course';