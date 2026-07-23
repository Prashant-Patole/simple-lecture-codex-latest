-- Add server_ip column to popular_subjects table
-- This stores the selected video generation server IP for each subject
ALTER TABLE popular_subjects 
ADD COLUMN IF NOT EXISTS server_ip TEXT DEFAULT '69.197.145.4';