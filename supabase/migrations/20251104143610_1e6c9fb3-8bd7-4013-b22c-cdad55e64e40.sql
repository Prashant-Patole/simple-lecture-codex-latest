-- Clean up stuck LLM extraction jobs
UPDATE document_processing_jobs
SET status = 'failed',
    error_message = 'Job abandoned due to edge function shutdown - fixed with two-stage pipeline',
    completed_at = NOW()
WHERE status = 'running'
  AND job_type = 'llm_extraction'
  AND updated_at < NOW() - INTERVAL '5 minutes';