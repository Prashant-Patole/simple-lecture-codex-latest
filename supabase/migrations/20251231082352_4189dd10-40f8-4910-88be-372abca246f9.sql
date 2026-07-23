-- Add chapter_id column to questions table for chapter-level questions
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.subject_chapters(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON public.questions(chapter_id);

-- Add comment for clarity
COMMENT ON COLUMN public.questions.chapter_id IS 'Direct chapter reference for chapter-level questions (when topic_id is NULL)';