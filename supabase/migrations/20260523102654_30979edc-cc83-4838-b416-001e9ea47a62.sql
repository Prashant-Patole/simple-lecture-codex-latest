
ALTER TABLE public.self_test_answers
  ADD COLUMN IF NOT EXISTS marks_awarded numeric,
  ADD COLUMN IF NOT EXISTS max_marks numeric,
  ADD COLUMN IF NOT EXISTS ai_feedback text,
  ADD COLUMN IF NOT EXISTS extracted_text text;

ALTER TABLE public.self_tests
  ADD COLUMN IF NOT EXISTS written_score numeric,
  ADD COLUMN IF NOT EXISTS total_score numeric,
  ADD COLUMN IF NOT EXISTS total_max_marks numeric;
