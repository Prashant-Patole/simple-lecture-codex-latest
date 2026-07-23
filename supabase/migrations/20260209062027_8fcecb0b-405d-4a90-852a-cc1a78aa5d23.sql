-- RPC function for paginated question bank with all filters
CREATE OR REPLACE FUNCTION get_question_bank_page(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_category_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_chapter_id uuid DEFAULT NULL,
  p_topic_id uuid DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_question_format text DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_is_verified boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question_text text,
  question_type text,
  question_format text,
  options jsonb,
  correct_answer text,
  explanation text,
  marks int,
  difficulty text,
  is_verified boolean,
  is_ai_generated boolean,
  is_important boolean,
  contains_formula boolean,
  topic_id uuid,
  chapter_id uuid,
  source_document_purpose text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_ids uuid[];
  v_chapter_ids uuid[];
  v_total bigint;
BEGIN
  -- Pre-compute topic/chapter IDs for category/subject filtering
  IF p_category_id IS NOT NULL THEN
    SELECT array_agg(t.id) INTO v_topic_ids
    FROM subject_topics t
    JOIN subject_chapters c ON c.id = t.chapter_id
    JOIN popular_subjects s ON s.id = c.subject_id
    WHERE s.category_id = p_category_id;
    
    SELECT array_agg(c.id) INTO v_chapter_ids
    FROM subject_chapters c
    JOIN popular_subjects s ON s.id = c.subject_id
    WHERE s.category_id = p_category_id;
  ELSIF p_subject_id IS NOT NULL THEN
    SELECT array_agg(t.id) INTO v_topic_ids
    FROM subject_topics t
    JOIN subject_chapters c ON c.id = t.chapter_id
    WHERE c.subject_id = p_subject_id;
    
    SELECT array_agg(sc.id) INTO v_chapter_ids
    FROM subject_chapters sc WHERE sc.subject_id = p_subject_id;
  ELSIF p_chapter_id IS NOT NULL THEN
    SELECT array_agg(st.id) INTO v_topic_ids
    FROM subject_topics st WHERE st.chapter_id = p_chapter_id;
    v_chapter_ids := ARRAY[p_chapter_id];
  END IF;

  -- Get total count first
  SELECT COUNT(*) INTO v_total
  FROM questions q
  WHERE
    -- Topic/Chapter filtering
    (
      (p_topic_id IS NOT NULL AND q.topic_id = p_topic_id)
      OR (p_topic_id IS NULL AND v_topic_ids IS NOT NULL AND (
        q.topic_id = ANY(v_topic_ids) 
        OR (q.topic_id IS NULL AND q.chapter_id = ANY(v_chapter_ids))
      ))
      OR (p_topic_id IS NULL AND v_topic_ids IS NULL)
    )
    -- Other filters
    AND (p_difficulty IS NULL OR q.difficulty = p_difficulty)
    AND (p_question_format IS NULL OR q.question_format = p_question_format)
    AND (p_source_type IS NULL OR COALESCE(q.source_document_purpose, 'general') = p_source_type)
    AND (p_search_query IS NULL OR q.question_text ILIKE '%' || p_search_query || '%')
    AND (p_is_verified IS NULL OR q.is_verified = p_is_verified);

  RETURN QUERY
  SELECT 
    q.id,
    q.question_text,
    q.question_type,
    q.question_format,
    q.options,
    q.correct_answer,
    q.explanation,
    q.marks,
    q.difficulty,
    q.is_verified,
    q.is_ai_generated,
    q.is_important,
    q.contains_formula,
    q.topic_id,
    q.chapter_id,
    q.source_document_purpose,
    q.created_at,
    v_total as total_count
  FROM questions q
  WHERE
    -- Topic/Chapter filtering
    (
      (p_topic_id IS NOT NULL AND q.topic_id = p_topic_id)
      OR (p_topic_id IS NULL AND v_topic_ids IS NOT NULL AND (
        q.topic_id = ANY(v_topic_ids) 
        OR (q.topic_id IS NULL AND q.chapter_id = ANY(v_chapter_ids))
      ))
      OR (p_topic_id IS NULL AND v_topic_ids IS NULL)
    )
    -- Other filters
    AND (p_difficulty IS NULL OR q.difficulty = p_difficulty)
    AND (p_question_format IS NULL OR q.question_format = p_question_format)
    AND (p_source_type IS NULL OR COALESCE(q.source_document_purpose, 'general') = p_source_type)
    AND (p_search_query IS NULL OR q.question_text ILIKE '%' || p_search_query || '%')
    AND (p_is_verified IS NULL OR q.is_verified = p_is_verified)
  ORDER BY q.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_questions_bank_filters
ON questions (question_format, difficulty, created_at DESC);

-- Index for source type filtering
CREATE INDEX IF NOT EXISTS idx_questions_source_purpose
ON questions (source_document_purpose, created_at DESC)
WHERE source_document_purpose IS NOT NULL;

-- Partial index for verified questions
CREATE INDEX IF NOT EXISTS idx_questions_verified
ON questions (is_verified, created_at DESC)
WHERE is_verified = true;