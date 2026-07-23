-- Add thumbnail_url column to popular_subjects table for subject images
ALTER TABLE popular_subjects 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;