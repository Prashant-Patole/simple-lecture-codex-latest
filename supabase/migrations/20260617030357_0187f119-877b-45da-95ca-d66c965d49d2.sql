DROP INDEX IF EXISTS public.idx_teaching_qa_cache_lookup;
DROP INDEX IF EXISTS public.idx_teaching_qa_cache_chapter_lookup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teaching_qa_cache_subject_hash_var
  ON public.teaching_qa_cache (subject_id, question_hash, language, variation_number)
  WHERE subject_id IS NOT NULL;