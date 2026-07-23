UPDATE public.video_generation_jobs
SET status = 'completed',
    progress = 100,
    video_url = 'http://69.197.145.4:5005/player_v2/?job=ID_PHARM_20260603165945466_E2QTH_e4f7e5ce',
    completed_at = COALESCE(completed_at, now()),
    error_message = NULL
WHERE external_job_id = 'ID_PHARM_20260603165945466_E2QTH_e4f7e5ce';