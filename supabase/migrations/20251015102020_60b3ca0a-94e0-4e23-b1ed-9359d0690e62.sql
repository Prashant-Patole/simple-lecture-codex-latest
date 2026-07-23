-- Fix FK: questions.topic_id should reference subject_topics.id instead of topics.id
BEGIN;

-- Drop existing FK constraint if it exists
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_topic_id_fkey;

-- Clean invalid references before attaching the new FK
UPDATE public.questions q
SET topic_id = NULL
WHERE topic_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.subject_topics st WHERE st.id = q.topic_id
  );

-- Add correct FK to subject_topics
ALTER TABLE public.questions
  ADD CONSTRAINT questions_topic_id_fkey
  FOREIGN KEY (topic_id)
  REFERENCES public.subject_topics (id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

COMMIT;