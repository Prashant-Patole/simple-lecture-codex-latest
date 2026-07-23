-- Phase 10: Add database indexes for performance optimization (50M users scale)

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_course_categories_course ON course_categories(course_id);
CREATE INDEX IF NOT EXISTS idx_course_subjects_course ON course_subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_active ON enrollments(student_id, is_active);
CREATE INDEX IF NOT EXISTS idx_instructor_timetables_instructor_active ON instructor_timetables(instructor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_course_instructors_course ON course_instructors(course_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_teacher ON course_instructors(teacher_id);

-- Covering indexes for frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_courses_active_price ON courses(is_active, price_inr) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug) WHERE is_active = true;

-- Indexes for subject and category lookups
CREATE INDEX IF NOT EXISTS idx_popular_subjects_slug ON popular_subjects(slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id) WHERE is_active = true;

-- Indexes for student progress and enrollments
CREATE INDEX IF NOT EXISTS idx_student_progress_student ON student_progress(student_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id, assignment_id);

-- Indexes for timetables and scheduled classes
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_course ON scheduled_classes(course_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_teacher ON scheduled_classes(teacher_id, scheduled_at);

-- Phase 11: Create documentation_pages table
CREATE TABLE IF NOT EXISTS documentation_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('api', 'instruction')),
  subcategory TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on documentation_pages
ALTER TABLE documentation_pages ENABLE ROW LEVEL SECURITY;

-- Admins can manage documentation
CREATE POLICY "Admins manage documentation" ON documentation_pages
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active documentation
CREATE POLICY "Anyone view active documentation" ON documentation_pages
  FOR SELECT
  USING (is_active = true);

-- Add index for documentation lookups
CREATE INDEX IF NOT EXISTS idx_documentation_category ON documentation_pages(category, subcategory, display_order);

-- Add trigger for updated_at
CREATE TRIGGER update_documentation_pages_updated_at
  BEFORE UPDATE ON documentation_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();