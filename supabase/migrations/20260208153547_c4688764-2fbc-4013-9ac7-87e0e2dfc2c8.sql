-- Add answer_source column to track where the answer came from
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS answer_source VARCHAR(20) DEFAULT 'document';

-- Add comment for documentation
COMMENT ON COLUMN questions.answer_source IS 'Source of the answer: document (extracted from document), ai_generated (LLM generated), manual (admin entered)';