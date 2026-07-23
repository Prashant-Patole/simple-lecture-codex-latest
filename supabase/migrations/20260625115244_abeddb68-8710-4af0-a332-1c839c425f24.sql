UPDATE public.video_generation_jobs
SET target_port = 5006,
    status = 'processing',
    error_message = NULL,
    completed_at = NULL,
    updated_at = now()
WHERE external_job_id = 'Science_20260625113534410_GUPKJA_db99e97b';