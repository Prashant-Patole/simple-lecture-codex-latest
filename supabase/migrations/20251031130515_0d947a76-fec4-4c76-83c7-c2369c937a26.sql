-- Step 1: Add course_id to instructor_subjects
ALTER TABLE instructor_subjects 
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);

-- Step 2: Create composite index for performance
CREATE INDEX IF NOT EXISTS idx_instructor_subjects_lookup 
ON instructor_subjects(instructor_id, subject_id, course_id, category_id);

-- Step 3: Migrate data from course_instructors to instructor_subjects
INSERT INTO instructor_subjects (instructor_id, subject_id, category_id, course_id, created_at)
SELECT 
  teacher_id as instructor_id,
  subject_id,
  NULL as category_id,
  course_id,
  assigned_at as created_at
FROM course_instructors
ON CONFLICT DO NOTHING;

-- Step 4: Drop the old course_instructors table
DROP TABLE IF EXISTS course_instructors CASCADE;