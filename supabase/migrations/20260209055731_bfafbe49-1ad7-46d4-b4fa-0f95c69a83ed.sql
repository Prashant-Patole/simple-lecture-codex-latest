-- Create optimized RPC function for enrolled courses with progress
-- Consolidates 4 query roundtrips into 1 server-side operation

CREATE OR REPLACE FUNCTION get_enrolled_courses_with_progress(p_student_id uuid)
RETURNS TABLE (
  course_id uuid,
  course_name text,
  course_slug text,
  thumbnail_url text,
  short_description text,
  duration_months int,
  enrolled_at timestamptz,
  progress int,
  category_id uuid,
  category_name text,
  parent_category_id uuid,
  parent_category_name text,
  parent_category_icon text
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH enrolled AS (
    SELECT e.course_id, e.enrolled_at
    FROM enrollments e
    WHERE e.student_id = p_student_id AND e.is_active = true
  ),
  course_data AS (
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.short_description,
      c.duration_months::int,
      COALESCE(
        ct.storage_url, 
        CASE WHEN c.thumbnail_url LIKE 'http%' THEN c.thumbnail_url ELSE NULL END
      ) as thumbnail_url
    FROM courses c
    LEFT JOIN course_thumbnails ct ON ct.course_id = c.id
    WHERE c.id IN (SELECT ec.course_id FROM enrolled ec)
  ),
  chapter_counts AS (
    SELECT 
      ch.course_id,
      COUNT(ch.id)::int as total,
      COUNT(sp.id) FILTER (WHERE sp.is_completed)::int as completed
    FROM chapters ch
    LEFT JOIN student_progress sp ON sp.chapter_id = ch.id AND sp.student_id = p_student_id
    WHERE ch.course_id IN (SELECT ec.course_id FROM enrolled ec)
    GROUP BY ch.course_id
  ),
  category_info AS (
    SELECT DISTINCT ON (cc.course_id)
      cc.course_id,
      cat.id as category_id,
      cat.name as category_name,
      COALESCE(parent.id, cat.id) as parent_id,
      COALESCE(parent.name, cat.name) as parent_name,
      COALESCE(parent.icon, cat.icon) as parent_icon
    FROM course_categories cc
    JOIN categories cat ON cat.id = cc.category_id
    LEFT JOIN categories parent ON parent.id = cat.parent_id
    WHERE cc.course_id IN (SELECT ec.course_id FROM enrolled ec)
    ORDER BY cc.course_id, cat.level DESC
  )
  SELECT 
    cd.id,
    cd.name,
    cd.slug,
    cd.thumbnail_url,
    cd.short_description,
    cd.duration_months,
    e.enrolled_at,
    CASE WHEN COALESCE(cc.total, 0) > 0 
      THEN ROUND((cc.completed::numeric / cc.total) * 100)::int 
      ELSE 0 
    END as progress,
    ci.category_id,
    ci.category_name,
    ci.parent_id,
    ci.parent_name,
    ci.parent_icon
  FROM enrolled e
  JOIN course_data cd ON cd.id = e.course_id
  LEFT JOIN chapter_counts cc ON cc.course_id = e.course_id
  LEFT JOIN category_info ci ON ci.course_id = e.course_id
  ORDER BY e.enrolled_at DESC;
END;
$$;

-- Add index for faster progress calculation
CREATE INDEX IF NOT EXISTS idx_student_progress_completed 
ON student_progress (student_id, chapter_id) 
WHERE is_completed = true;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_enrolled_courses_with_progress(uuid) TO authenticated;