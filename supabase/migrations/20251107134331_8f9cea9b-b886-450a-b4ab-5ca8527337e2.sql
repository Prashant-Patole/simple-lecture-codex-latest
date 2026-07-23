-- Add dual-PDF support columns to uploaded_question_documents table

-- Add questions file columns
ALTER TABLE uploaded_question_documents
ADD COLUMN IF NOT EXISTS questions_file_name TEXT,
ADD COLUMN IF NOT EXISTS questions_file_url TEXT,
ADD COLUMN IF NOT EXISTS questions_mmd_content TEXT;

-- Add solutions file columns
ALTER TABLE uploaded_question_documents
ADD COLUMN IF NOT EXISTS solutions_file_name TEXT,
ADD COLUMN IF NOT EXISTS solutions_file_url TEXT,
ADD COLUMN IF NOT EXISTS solutions_mmd_content TEXT;

-- Update existing records to use new column structure (migrate old single-file data)
-- Only migrate if the old columns exist and new ones are empty
UPDATE uploaded_question_documents
SET 
  questions_file_name = COALESCE(questions_file_name, file_name),
  questions_file_url = COALESCE(questions_file_url, file_url)
WHERE file_name IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN uploaded_question_documents.questions_file_name IS 'Filename of the questions PDF';
COMMENT ON COLUMN uploaded_question_documents.questions_file_url IS 'Storage URL for questions PDF';
COMMENT ON COLUMN uploaded_question_documents.questions_mmd_content IS 'Mathpix MMD content extracted from questions PDF';
COMMENT ON COLUMN uploaded_question_documents.solutions_file_name IS 'Filename of the solutions PDF';
COMMENT ON COLUMN uploaded_question_documents.solutions_file_url IS 'Storage URL for solutions PDF';
COMMENT ON COLUMN uploaded_question_documents.solutions_mmd_content IS 'Mathpix MMD content extracted from solutions PDF';