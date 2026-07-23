-- Add server_ip column to language_avatar_jobs table
-- This stores which server the job was created on for correct status polling
ALTER TABLE language_avatar_jobs ADD COLUMN server_ip TEXT;