ALTER TABLE public.video_generation_jobs
  ADD COLUMN IF NOT EXISTS reconcile_miss_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;