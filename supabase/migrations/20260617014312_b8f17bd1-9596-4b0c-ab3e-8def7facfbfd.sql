
ALTER TABLE public.teaching_qa_cache
  ADD COLUMN IF NOT EXISTS subject_id UUID;

-- Backfill from topic_id
UPDATE public.teaching_qa_cache c
SET subject_id = sc.subject_id
FROM public.subject_topics st
JOIN public.subject_chapters sc ON sc.id = st.chapter_id
WHERE c.subject_id IS NULL
  AND c.topic_id IS NOT NULL
  AND st.id = c.topic_id;

-- Backfill from chapter_id
UPDATE public.teaching_qa_cache c
SET subject_id = sc.subject_id
FROM public.subject_chapters sc
WHERE c.subject_id IS NULL
  AND c.chapter_id IS NOT NULL
  AND sc.id = c.chapter_id;

CREATE INDEX IF NOT EXISTS idx_teaching_qa_cache_subject_hash
  ON public.teaching_qa_cache (subject_id, question_hash);
