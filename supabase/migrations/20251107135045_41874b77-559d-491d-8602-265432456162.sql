-- Make legacy single-file columns nullable to support dual-PDF structure
ALTER TABLE uploaded_question_documents
ALTER COLUMN file_name DROP NOT NULL;

ALTER TABLE uploaded_question_documents
ALTER COLUMN file_url DROP NOT NULL;

-- Add a check constraint to ensure at least one file structure is present
ALTER TABLE uploaded_question_documents
ADD CONSTRAINT file_structure_check CHECK (
  (file_name IS NOT NULL AND file_url IS NOT NULL) OR
  (questions_file_name IS NOT NULL AND questions_file_url IS NOT NULL)
);

COMMENT ON CONSTRAINT file_structure_check ON uploaded_question_documents IS 
'Ensures either legacy single-file structure or new dual-file structure is present';