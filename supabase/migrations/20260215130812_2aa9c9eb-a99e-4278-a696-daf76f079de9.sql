-- Add columns to auto_pipeline_runs for server-side pipeline execution
ALTER TABLE public.auto_pipeline_runs 
  ADD COLUMN IF NOT EXISTS scan_results JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS job_queue JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pipeline_config JSONB DEFAULT '{"max_retries": 3, "poll_interval_seconds": 10, "max_jobs_per_ip": 2}'::jsonb;

-- Enable pg_cron and pg_net extensions for scheduled edge function calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;