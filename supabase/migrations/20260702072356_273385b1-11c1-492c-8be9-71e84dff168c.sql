ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS topic_id uuid,
  ADD COLUMN IF NOT EXISTS chapter_id uuid;
CREATE INDEX IF NOT EXISTS idx_test_results_topic ON public.test_results(topic_id);
CREATE INDEX IF NOT EXISTS idx_test_results_chapter ON public.test_results(chapter_id);