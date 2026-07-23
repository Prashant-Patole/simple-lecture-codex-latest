-- Add missing fields for dashboard enhancement

-- Add room_number and is_live to scheduled_classes
ALTER TABLE scheduled_classes 
ADD COLUMN IF NOT EXISTS room_number text,
ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT false;

-- Add homework_date and submission_date to assignments
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS homework_date date,
ADD COLUMN IF NOT EXISTS submission_date date;

-- Create index for faster live class queries
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_live 
ON scheduled_classes(is_live, scheduled_at) 
WHERE is_live = true;

-- Create index for assignment dates
CREATE INDEX IF NOT EXISTS idx_assignments_dates 
ON assignments(homework_date, submission_date);

COMMENT ON COLUMN scheduled_classes.room_number IS 'Physical classroom number or online room ID';
COMMENT ON COLUMN scheduled_classes.is_live IS 'Whether the class is currently live/ongoing';
COMMENT ON COLUMN assignments.homework_date IS 'Date when homework was assigned';
COMMENT ON COLUMN assignments.submission_date IS 'Due date for assignment submission';