-- Add new columns to assignments table for subject-level assignments
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.popular_subjects(id),
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS ai_generation_config JSONB,
ADD COLUMN IF NOT EXISTS instructions TEXT,
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON public.assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_chapter_id ON public.assignments(chapter_id);

-- Add RLS policies for assignments if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assignments' AND policyname = 'Anyone can view active assignments'
  ) THEN
    CREATE POLICY "Anyone can view active assignments" ON public.assignments FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assignments' AND policyname = 'Admins can manage assignments'
  ) THEN
    CREATE POLICY "Admins can manage assignments" ON public.assignments FOR ALL USING (true);
  END IF;
END $$;