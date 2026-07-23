-- Add foreign key constraint between scheduled_classes and teacher_profiles
ALTER TABLE scheduled_classes
ADD CONSTRAINT fk_scheduled_classes_teacher
FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id)
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_teacher
ON scheduled_classes(teacher_id);