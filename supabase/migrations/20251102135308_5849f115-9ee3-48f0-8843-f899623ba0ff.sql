-- Phase 1.1: Enforce Single Category per Subject
-- Add category_id to popular_subjects
ALTER TABLE popular_subjects 
ADD COLUMN IF NOT EXISTS category_id UUID;

-- First, assign default categories to subjects without any categories
-- Mathematics (Boards/JEE) -> JEE Main
UPDATE popular_subjects 
SET category_id = '7258ae17-41de-45c9-90e3-19b2ae5b4ef4'
WHERE name = 'Mathematics (Boards/JEE)' AND category_id IS NULL;

-- Biology (NEET) -> NEET UG
UPDATE popular_subjects 
SET category_id = '9c7f969a-c8e1-4454-b4fd-b9b97093ae50'
WHERE name = 'Biology (NEET)' AND category_id IS NULL;

-- English (Boards) -> Board Exams
UPDATE popular_subjects 
SET category_id = 'd1807178-486e-483b-bdb9-a2b095eb96e8'
WHERE name = 'English (Boards)' AND category_id IS NULL;

-- Kannada (State Boards) -> Board Exams
UPDATE popular_subjects 
SET category_id = 'd1807178-486e-483b-bdb9-a2b095eb96e8'
WHERE name = 'Kannada (State Boards)' AND category_id IS NULL;

-- Hindi (Boards) -> Board Exams
UPDATE popular_subjects 
SET category_id = 'd1807178-486e-483b-bdb9-a2b095eb96e8'
WHERE name = 'Hindi (Boards)' AND category_id IS NULL;

-- Social Science -> Board Exams
UPDATE popular_subjects 
SET category_id = 'd1807178-486e-483b-bdb9-a2b095eb96e8'
WHERE name = 'Social Science' AND category_id IS NULL;

-- Migrate subjects with categories from subject_categories table
UPDATE popular_subjects ps
SET category_id = (
  SELECT sc.category_id 
  FROM subject_categories sc 
  WHERE sc.subject_id = ps.id 
  LIMIT 1
)
WHERE id IN (
  SELECT subject_id 
  FROM subject_categories 
  GROUP BY subject_id 
  HAVING COUNT(*) = 1
)
AND category_id IS NULL;

-- For multi-category subjects, select the first category
UPDATE popular_subjects ps
SET category_id = (
  SELECT sc.category_id 
  FROM subject_categories sc 
  WHERE sc.subject_id = ps.id 
  ORDER BY sc.created_at 
  LIMIT 1
)
WHERE category_id IS NULL 
AND EXISTS (SELECT 1 FROM subject_categories WHERE subject_id = ps.id);

-- Add foreign key constraint
ALTER TABLE popular_subjects 
ADD CONSTRAINT popular_subjects_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES categories(id);

-- Make it NOT NULL after migration
ALTER TABLE popular_subjects 
ALTER COLUMN category_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_popular_subjects_category 
ON popular_subjects(category_id);

-- Phase 1.2: Clean Up Duplicate Instructor Assignments
-- Delete duplicate instructor-subject assignments (keep most recent)
DELETE FROM instructor_subjects
WHERE id NOT IN (
  SELECT DISTINCT ON (instructor_id, subject_id, COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
    id
  FROM instructor_subjects
  ORDER BY instructor_id, subject_id, COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid), created_at DESC
);

-- Remove redundant category_id column (already done in previous migration, so safe to keep)
ALTER TABLE instructor_subjects
DROP COLUMN IF EXISTS category_id;

-- Add unique constraint
ALTER TABLE instructor_subjects
DROP CONSTRAINT IF EXISTS unique_instructor_subject_course;

ALTER TABLE instructor_subjects
ADD CONSTRAINT unique_instructor_subject_course 
UNIQUE NULLS NOT DISTINCT (instructor_id, subject_id, course_id);

-- Phase 1.3: Add Instructor Credential Management Support
-- Add user_id reference to teacher_profiles
ALTER TABLE teacher_profiles
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user_id 
ON teacher_profiles(user_id);

-- Update existing instructors to link with auth.users by email
UPDATE teacher_profiles tp
SET user_id = au.id
FROM auth.users au
WHERE tp.email = au.email
AND tp.user_id IS NULL;

-- Drop subject_categories table after migration
DROP TABLE IF EXISTS subject_categories;