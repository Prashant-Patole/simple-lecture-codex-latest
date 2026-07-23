
-- Add variation_number column to teaching_qa_cache (default 1 for existing rows)
ALTER TABLE public.teaching_qa_cache 
ADD COLUMN IF NOT EXISTS variation_number integer NOT NULL DEFAULT 1;

-- Drop existing unique indexes that enforce 1 entry per question
DROP INDEX IF EXISTS idx_teaching_qa_cache_topic_hash_lang;
DROP INDEX IF EXISTS idx_teaching_qa_cache_chapter_hash_lang;
DROP INDEX IF EXISTS idx_teaching_qa_cache_topic_hash;
DROP INDEX IF EXISTS idx_teaching_qa_cache_chapter_hash;

-- Create new unique indexes that allow up to 3 variations
CREATE UNIQUE INDEX idx_teaching_qa_cache_topic_hash_var 
ON public.teaching_qa_cache (topic_id, question_hash, language, variation_number) 
WHERE topic_id IS NOT NULL;

CREATE UNIQUE INDEX idx_teaching_qa_cache_chapter_hash_var 
ON public.teaching_qa_cache (chapter_id, question_hash, language, variation_number) 
WHERE chapter_id IS NOT NULL;
