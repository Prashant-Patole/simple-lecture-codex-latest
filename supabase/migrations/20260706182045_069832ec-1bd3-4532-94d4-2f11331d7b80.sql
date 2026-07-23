
CREATE OR REPLACE FUNCTION public.get_language_coverage_scan(p_subject_name text, p_language text)
 RETURNS TABLE(job_id text, external_job_id text, document_name text, subject_name text, chapter_number integer, chapter_title text, topic_title text, total_sections integer, language_sections integer, coverage_status text, server_ip text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH scanned AS (
    SELECT
      j.id::text AS job_id,
      j.external_job_id,
      j.document_name,
      ps.name AS subject_name,
      sc.chapter_number,
      sc.title AS chapter_title,
      st.title AS topic_title,
      j.server_ip,
      j.created_at,
      COALESCE(jsonb_array_length(j.presentation_json->'sections'), 0) AS total_sections,
      (
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(COALESCE(j.presentation_json->'sections', '[]'::jsonb)) s
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(s->'avatar_languages', '[]'::jsonb)) a
          WHERE lower(a->>'language') = lower(p_language)
            AND lower(a->>'status') IN ('completed','ready','success')
        )
      ) AS language_sections
    FROM video_generation_jobs j
    JOIN ai_assistant_documents d ON d.id = j.document_id
    JOIN subject_chapters sc ON sc.id = d.chapter_id
    JOIN popular_subjects ps ON ps.id = sc.subject_id
    LEFT JOIN subject_topics st ON st.id = d.topic_id
    WHERE j.is_published = true
      AND j.status = 'completed'
      AND (p_subject_name IS NULL OR lower(ps.name) = lower(p_subject_name))
  )
  SELECT
    s.job_id, s.external_job_id, s.document_name, s.subject_name,
    s.chapter_number, s.chapter_title, s.topic_title,
    s.total_sections, s.language_sections,
    CASE
      WHEN s.total_sections = 0 THEN 'missing'
      WHEN s.language_sections >= s.total_sections THEN 'full'
      WHEN s.language_sections = 0 THEN 'missing'
      ELSE 'partial'
    END AS coverage_status,
    s.server_ip, s.created_at
  FROM scanned s
  ORDER BY s.subject_name, s.chapter_number NULLS LAST, s.chapter_title, s.topic_title, s.document_name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_language_coverage_scan(text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
