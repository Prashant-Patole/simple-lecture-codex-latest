-- Reset stuck documents back to pending status
UPDATE uploaded_question_documents
SET 
  status = 'pending',
  current_job_id = NULL,
  processing_started_at = NULL,
  error_message = NULL
WHERE status = 'processing' OR status = 'failed';