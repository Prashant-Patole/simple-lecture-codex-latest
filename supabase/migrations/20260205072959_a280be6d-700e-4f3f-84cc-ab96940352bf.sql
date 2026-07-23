-- =====================================================
-- PHASE 1: Critical Performance Indexes
-- =====================================================

-- Featured courses index for homepage queries
CREATE INDEX IF NOT EXISTS idx_featured_courses_active_section 
ON featured_courses(is_active, section_type, display_order);

-- Categories partial index for active only
CREATE INDEX IF NOT EXISTS idx_categories_active_display 
ON categories(is_active, display_order) 
WHERE is_active = true;

-- Courses partial index for active listings
CREATE INDEX IF NOT EXISTS idx_courses_active_sequence 
ON courses(is_active, sequence_order) 
WHERE is_active = true;

-- Popular subjects partial index
CREATE INDEX IF NOT EXISTS idx_popular_subjects_active_display 
ON popular_subjects(is_active, display_order) 
WHERE is_active = true;

-- Explore by goal for homepage
CREATE INDEX IF NOT EXISTS idx_explore_by_goal_active 
ON explore_by_goal(is_active, display_order) 
WHERE is_active = true;

-- =====================================================
-- PHASE 2: Foreign Key & Relationship Indexes
-- =====================================================

-- Course subjects join optimization
CREATE INDEX IF NOT EXISTS idx_course_subjects_subject 
ON course_subjects(subject_id);

-- Forum posts optimization
CREATE INDEX IF NOT EXISTS idx_forum_posts_category 
ON forum_posts(category_id);

CREATE INDEX IF NOT EXISTS idx_forum_posts_created 
ON forum_posts(created_at DESC);

-- Video generation jobs (admin)
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status 
ON video_generation_jobs(status);

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_created 
ON video_generation_jobs(created_at DESC);

-- =====================================================
-- PHASE 3: Composite Indexes
-- =====================================================

-- Assignments with active filter
CREATE INDEX IF NOT EXISTS idx_assignments_active_dates 
ON assignments(is_active, homework_date, submission_date)
WHERE is_active = true;

-- Daily attendance for mobile
CREATE INDEX IF NOT EXISTS idx_daily_attendance_student_date 
ON daily_login_attendance(student_id, attendance_date DESC);

-- =====================================================
-- PHASE 4: RLS for Security
-- =====================================================

-- Enable RLS on exposed tables
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_enhancements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_storyboards ENABLE ROW LEVEL SECURITY;

-- Create read policies for authenticated users
CREATE POLICY "Authenticated read approvals" ON approvals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read jobs" ON jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read summaries" ON learning_summaries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read enhancements" ON image_enhancements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read ocr" ON ocr_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read slide_results" ON slide_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read slides" ON slides
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read storyboards" ON video_storyboards
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- PHASE 5: Fix Function Search Paths
-- =====================================================

-- Fix get_category_descendants with explicit search_path
CREATE OR REPLACE FUNCTION public.get_category_descendants(parent_uuid uuid)
RETURNS TABLE(category_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH RECURSIVE category_tree AS (
  SELECT id FROM categories WHERE id = parent_uuid AND is_active = true
  UNION ALL
  SELECT c.id 
  FROM categories c
  INNER JOIN category_tree ct ON c.parent_id = ct.id
  WHERE c.is_active = true
)
SELECT id as category_id FROM category_tree;
$$;

-- =====================================================
-- ANALYZE tables for query planner
-- =====================================================

ANALYZE featured_courses;
ANALYZE categories;
ANALYZE courses;
ANALYZE popular_subjects;
ANALYZE explore_by_goal;
ANALYZE course_subjects;
ANALYZE forum_posts;
ANALYZE video_generation_jobs;
ANALYZE assignments;
ANALYZE daily_login_attendance;