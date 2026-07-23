-- Backfill existing completed language avatar jobs with constructed avatar URLs
UPDATE language_avatar_jobs 
SET avatar_url = CONCAT('http://69.197.145.4:5004/outputs/', task_id, '.mp4'),
    updated_at = now()
WHERE status = 'completed' 
  AND avatar_url IS NULL 
  AND task_id IS NOT NULL;