
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_questions_qtext_trgm
  ON public.questions USING gin (question_text gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.find_similar_questions(
  p_text text,
  p_subject_id uuid DEFAULT NULL,
  p_topic_id uuid DEFAULT NULL,
  p_limit int DEFAULT 6
)
RETURNS TABLE(id uuid, question_text text, score real, bucket text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_ids uuid[];
BEGIN
  IF p_text IS NULL OR length(btrim(p_text)) < 3 THEN
    RETURN;
  END IF;

  IF p_subject_id IS NOT NULL THEN
    SELECT array_agg(t.id) INTO v_topic_ids
    FROM subject_topics t
    JOIN subject_chapters c ON c.id = t.chapter_id
    WHERE c.subject_id = p_subject_id;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT q.id, q.question_text,
           similarity(lower(q.question_text), lower(p_text)) AS trg
    FROM questions q
    WHERE (p_topic_id IS NULL OR q.topic_id = p_topic_id)
      AND (v_topic_ids IS NULL OR q.topic_id = ANY(v_topic_ids))
      AND q.question_text %> p_text
    LIMIT 200
  ),
  scored AS (
    SELECT c.id, c.question_text, c.trg,
      COALESCE((
        SELECT COUNT(*)::real FROM (
          SELECT w FROM unnest(regexp_split_to_array(
                   lower(regexp_replace(c.question_text, '[^a-z0-9 ]', ' ', 'g')), '\s+')) AS w
          WHERE length(w) >= 3
          INTERSECT
          SELECT w FROM unnest(regexp_split_to_array(
                   lower(regexp_replace(p_text, '[^a-z0-9 ]', ' ', 'g')), '\s+')) AS w
          WHERE length(w) >= 3
        ) i
      ), 0)
      /
      NULLIF((
        SELECT COUNT(*)::real FROM (
          SELECT w FROM unnest(regexp_split_to_array(
                   lower(regexp_replace(c.question_text, '[^a-z0-9 ]', ' ', 'g')), '\s+')) AS w
          WHERE length(w) >= 3
          UNION
          SELECT w FROM unnest(regexp_split_to_array(
                   lower(regexp_replace(p_text, '[^a-z0-9 ]', ' ', 'g')), '\s+')) AS w
          WHERE length(w) >= 3
        ) u
      ), 0) AS jac
    FROM candidates c
  )
  SELECT s.id, s.question_text,
         (0.5 * COALESCE(s.jac, 0) + 0.5 * s.trg)::real AS score,
         CASE
           WHEN (0.5 * COALESCE(s.jac, 0) + 0.5 * s.trg) >= 0.75 THEN 'near_duplicate'
           WHEN (0.5 * COALESCE(s.jac, 0) + 0.5 * s.trg) >= 0.60 THEN 'related'
           ELSE 'weak'
         END AS bucket
  FROM scored s
  WHERE (0.5 * COALESCE(s.jac, 0) + 0.5 * s.trg) >= 0.60
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_questions(text, uuid, uuid, int)
  TO anon, authenticated, service_role;
