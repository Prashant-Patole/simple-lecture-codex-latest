UPDATE video_generation_jobs 
SET status = 'failed', error_message = 'Auto-cleaned: stale job'
WHERE status = 'pending' 
  AND external_job_id IS NULL 
  AND created_at < NOW() - INTERVAL '1 hour';

UPDATE video_generation_jobs 
SET status = 'failed', error_message = 'Auto-cleaned: stale processing job'
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '24 hours';