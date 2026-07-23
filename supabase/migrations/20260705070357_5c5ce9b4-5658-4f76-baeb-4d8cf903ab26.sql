
CREATE OR REPLACE FUNCTION public.get_kannada_coverage_scan(p_subject_name text)
RETURNS TABLE(
  job_id bigint,
  external_job_id text,
  document_name text,
  subject_name text,
  chapter_number integer,
  chapter_title text,
  topic_title text,
  total_sections integer,
  kannada_sections integer,
  coverage_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH scanned AS (
    SELECT
      j.id AS job_id,
      j.external_job_id,
      j.document_name,
      ps.name AS subject_name,
      sc.chapter_number,
      sc.title AS chapter_title,
      st.title AS topic_title,
      j.created_at,
      COALESCE(jsonb_array_length(j.presentation_json->'sections'), 0) AS total_sections,
      (
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(COALESCE(j.presentation_json->'sections', '[]'::jsonb)) s
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(s->'avatar_languages', '[]'::jsonb)) a
          WHERE lower(a->>'language') = 'kannada'
            AND lower(a->>'status') IN ('completed','ready','success')
        )
      ) AS kannada_sections
    FROM video_generation_jobs j
    JOIN ai_assistant_documents d ON d.id = j.document_id
    JOIN subject_chapters sc ON sc.id = d.chapter_id
    JOIN popular_subjects ps ON ps.id = sc.subject_id
    LEFT JOIN subject_topics st ON st.id = d.topic_id
    WHERE j.is_published = true
      AND j.status = 'completed'
      AND lower(ps.name) = lower(p_subject_name)
  )
  SELECT
    s.job_id,
    s.external_job_id,
    s.document_name,
    s.subject_name,
    s.chapter_number,
    s.chapter_title,
    s.topic_title,
    s.total_sections,
    s.kannada_sections,
    CASE
      WHEN s.total_sections = 0 THEN 'missing'
      WHEN s.kannada_sections >= s.total_sections THEN 'full'
      WHEN s.kannada_sections = 0 THEN 'missing'
      ELSE 'partial'
    END AS coverage_status,
    s.created_at
  FROM scanned s
  ORDER BY s.chapter_number NULLS LAST, s.chapter_title, s.topic_title, s.document_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kannada_coverage_scan(text) TO authenticated;
