-- Drop old unused question_uploads table
DROP TABLE IF EXISTS question_uploads CASCADE;

-- Add subtopic_id to uploaded_question_documents
ALTER TABLE uploaded_question_documents
ADD COLUMN IF NOT EXISTS subtopic_id UUID REFERENCES subtopics(id);

CREATE INDEX IF NOT EXISTS idx_uploaded_docs_subtopic 
ON uploaded_question_documents(subtopic_id);

-- Add subtopic_id to parsed_questions_pending (if not exists)
ALTER TABLE parsed_questions_pending
ADD COLUMN IF NOT EXISTS subtopic_id UUID REFERENCES subtopics(id);

CREATE INDEX IF NOT EXISTS idx_pending_questions_subtopic 
ON parsed_questions_pending(subtopic_id);