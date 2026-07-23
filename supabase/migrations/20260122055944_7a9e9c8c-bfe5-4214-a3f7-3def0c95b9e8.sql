-- Add document_purpose column to uploaded_question_documents table
ALTER TABLE uploaded_question_documents 
ADD COLUMN IF NOT EXISTS document_purpose TEXT DEFAULT 'general' 
CHECK (document_purpose IN ('dpp', 'proficiency_test', 'previous_year', 'exam', 'general'));

-- Add source_document_purpose column to questions table to track where questions came from
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS source_document_purpose TEXT;

-- Add source_document_id to track which document the question was extracted from
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES uploaded_question_documents(id) ON DELETE SET NULL;

-- Create index for faster filtering by document purpose
CREATE INDEX IF NOT EXISTS idx_questions_source_document_purpose ON questions(source_document_purpose);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_document_purpose ON uploaded_question_documents(document_purpose);

-- Create deduplication function that removes exact text duplicates (case-insensitive, trimmed)
CREATE OR REPLACE FUNCTION deduplicate_questions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(question_text)), COALESCE(chapter_id::text, ''), COALESCE(topic_id::text, '')
      ORDER BY created_at ASC
    ) as rn
    FROM questions
  )
  DELETE FROM questions 
  WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;