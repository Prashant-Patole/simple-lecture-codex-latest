-- Add is_important column to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;