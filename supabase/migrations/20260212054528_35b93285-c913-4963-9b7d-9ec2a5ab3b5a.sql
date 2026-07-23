UPDATE video_generation_jobs 
SET status = 'failed', 
    error_message = 'Auto-cleaned: stale processing job (2h+)'
WHERE id = '351859590' AND status = 'processing';