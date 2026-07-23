-- Add mathpix_mmd column to store Mathpix Markdown format
ALTER TABLE uploaded_question_documents
ADD COLUMN IF NOT EXISTS mathpix_mmd TEXT;

COMMENT ON COLUMN uploaded_question_documents.mathpix_mmd IS 'Mathpix Markdown format - preserves LaTeX and structure better than plain markdown';

-- Reset documents stuck in processing state without a job
UPDATE uploaded_question_documents
SET 
  status = 'pending',
  current_job_id = NULL,
  processing_started_at = NULL,
  error_message = 'Reset for reprocessing after Mathpix integration update'
WHERE status = 'processing' 
  AND current_job_id IS NULL;

-- Reset failed documents related to Mathpix errors for retry
UPDATE uploaded_question_documents
SET 
  status = 'pending',
  error_message = NULL
WHERE status = 'failed' 
  AND error_message LIKE '%Mathpix%';