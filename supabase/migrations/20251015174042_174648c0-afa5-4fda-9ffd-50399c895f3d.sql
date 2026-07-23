-- Add batch_id to enrollments for student-batch mapping
ALTER TABLE public.enrollments 
ADD COLUMN batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE INDEX idx_enrollments_batch_id ON public.enrollments(batch_id);

-- Add batch_id to course_timetables
ALTER TABLE public.course_timetables 
ADD COLUMN batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE INDEX idx_course_timetables_batch_id ON public.course_timetables(batch_id);

-- Add batch_id to instructor_timetables  
ALTER TABLE public.instructor_timetables 
ADD COLUMN batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE INDEX idx_instructor_timetables_batch_id ON public.instructor_timetables(batch_id);

-- Update RLS policies for course_timetables to include batch filtering
DROP POLICY IF EXISTS "Anyone can view active course timetables" ON public.course_timetables;
CREATE POLICY "Anyone can view active course timetables" 
ON public.course_timetables 
FOR SELECT 
USING (is_active = true);

-- Update RLS policies for instructor_timetables to include batch filtering
DROP POLICY IF EXISTS "Anyone can view active timetables" ON public.instructor_timetables;
CREATE POLICY "Anyone can view active timetables" 
ON public.instructor_timetables 
FOR SELECT 
USING (is_active = true);