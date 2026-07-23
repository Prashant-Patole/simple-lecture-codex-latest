-- Add display_name column for custom document naming
ALTER TABLE uploaded_question_documents 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create index for faster querying by subject
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_subject_id ON uploaded_question_documents(subject_id);