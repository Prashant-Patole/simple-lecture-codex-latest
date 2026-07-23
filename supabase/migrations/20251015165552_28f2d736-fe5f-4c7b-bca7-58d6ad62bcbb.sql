-- Add category column to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category text;