-- Add tracking columns to video_generation_jobs for external API integration
ALTER TABLE video_generation_jobs 
ADD COLUMN IF NOT EXISTS external_job_id TEXT,
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_step TEXT,
ADD COLUMN IF NOT EXISTS current_phase TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS steps_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;