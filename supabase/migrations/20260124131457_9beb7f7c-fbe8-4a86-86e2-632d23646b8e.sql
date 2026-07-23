-- Add completed_at column to video_generation_jobs table
ALTER TABLE public.video_generation_jobs
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;