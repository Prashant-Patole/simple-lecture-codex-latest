-- Phase 1: RPC function for consolidated course data + enrollment check
CREATE OR REPLACE FUNCTION get_learning_course_data(p_course_id uuid, p_student_id uuid)
RETURNS TABLE (
  is_enrolled boolean,
  course_id uuid,
  course_name text,
  course_slug text,
  thumbnail_url text,
  available_languages jsonb,
  language_topup_price numeric,
  language_topup_original_price numeric,
  subjects jsonb
) AS $$
DECLARE
  v_enrolled boolean;
BEGIN
  -- Check enrollment
  SELECT EXISTS(
    SELECT 1 FROM enrollments 
    WHERE enrollments.course_id = p_course_id 
    AND student_id = p_student_id 
    AND is_active = true
  ) INTO v_enrolled;
  
  IF NOT v_enrolled THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::jsonb, NULL::numeric, NULL::numeric, NULL::jsonb;
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    true,
    c.id,
    c.name,
    c.slug,
    c.thumbnail_url,
    c.available_languages,
    c.language_topup_price,
    c.language_topup_original_price,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ps.id,
          'name', ps.name,
          'slug', ps.slug,
          'thumbnail_url', ps.thumbnail_url
        ) ORDER BY cs.display_order
      ) FILTER (WHERE ps.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM courses c
  LEFT JOIN course_subjects cs ON cs.course_id = c.id
  LEFT JOIN popular_subjects ps ON ps.id = cs.subject_id
  WHERE c.id = p_course_id
  GROUP BY c.id, c.name, c.slug, c.thumbnail_url, c.available_languages, c.language_topup_price, c.language_topup_original_price;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Phase 2: RPC function for chapters with nested topics (single query)
CREATE OR REPLACE FUNCTION get_subject_chapters_with_topics(p_subject_id uuid)
RETURNS TABLE (
  chapter_id uuid,
  chapter_number int,
  title text,
  description text,
  ai_generated_video_url text,
  topics jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.chapter_number,
    c.title,
    c.description,
    c.ai_generated_video_url,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'title', t.title,
          'topic_number', t.topic_number,
          'estimated_duration_minutes', t.estimated_duration_minutes,
          'video_id', t.video_id,
          'video_platform', t.video_platform,
          'ai_generated_video_url', t.ai_generated_video_url
        ) ORDER BY t.topic_number
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'::jsonb
    ) as topics
  FROM subject_chapters c
  LEFT JOIN subject_topics t ON t.chapter_id = c.id
  WHERE c.subject_id = p_subject_id
  GROUP BY c.id, c.chapter_number, c.title, c.description, c.ai_generated_video_url
  ORDER BY c.chapter_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- Phase 5: Strategic Database Indexes

-- Index for subject chapters lookup
CREATE INDEX IF NOT EXISTS idx_subject_chapters_subject_order 
ON subject_chapters (subject_id, chapter_number);

-- Index for subject topics lookup  
CREATE INDEX IF NOT EXISTS idx_subject_topics_chapter_order
ON subject_topics (chapter_id, topic_number);

-- Composite index for tests filtering (only active tests)
CREATE INDEX IF NOT EXISTS idx_tests_subject_type_active
ON tests (subject_id, test_type, is_active) 
WHERE is_active = true;

-- Index for MCQ questions filtering
CREATE INDEX IF NOT EXISTS idx_questions_topic_format
ON questions (topic_id, question_format)
WHERE question_format IN ('single_choice', 'multiple_choice');

-- Index for chapter questions
CREATE INDEX IF NOT EXISTS idx_questions_chapter_format
ON questions (chapter_id, question_format);