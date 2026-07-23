-- Add server_ip column to video_generation_jobs table
ALTER TABLE public.video_generation_jobs 
ADD COLUMN server_ip TEXT DEFAULT '69.197.145.4';

-- Add a comment for documentation
COMMENT ON COLUMN public.video_generation_jobs.server_ip IS 'The server IP address where this job was created/processed';