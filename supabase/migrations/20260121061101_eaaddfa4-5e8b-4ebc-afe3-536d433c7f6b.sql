-- Language-agnostic caching: Remove language from unique indexes
-- This allows one cached response to serve all languages (English text, translated TTS)

-- Drop existing language-specific unique indexes
DROP INDEX IF EXISTS idx_teaching_qa_cache_lookup;
DROP INDEX IF EXISTS idx_teaching_qa_cache_chapter_lookup;

-- Create new language-agnostic unique indexes (question_hash + scope only)
CREATE UNIQUE INDEX idx_teaching_qa_cache_lookup 
ON public.teaching_qa_cache(topic_id, question_hash) 
WHERE topic_id IS NOT NULL;

CREATE UNIQUE INDEX idx_teaching_qa_cache_chapter_lookup 
ON public.teaching_qa_cache(chapter_id, question_hash) 
WHERE chapter_id IS NOT NULL;

-- Set default language to en-IN (content is always English now)
ALTER TABLE public.teaching_qa_cache 
ALTER COLUMN language SET DEFAULT 'en-IN';

-- Add comment explaining the new caching strategy
COMMENT ON TABLE public.teaching_qa_cache IS 'Caches AI teaching responses. Content is always English. Language field indicates original request language. TTS translation happens on-the-fly client-side.';