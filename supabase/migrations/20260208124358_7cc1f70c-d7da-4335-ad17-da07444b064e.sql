-- Add promotional video URL column to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS promotional_video_url TEXT;