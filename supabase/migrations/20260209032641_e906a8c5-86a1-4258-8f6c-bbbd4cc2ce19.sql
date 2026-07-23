-- Add index for faster ordering on admin courses list
CREATE INDEX IF NOT EXISTS idx_courses_created_at_desc 
ON courses(created_at DESC);