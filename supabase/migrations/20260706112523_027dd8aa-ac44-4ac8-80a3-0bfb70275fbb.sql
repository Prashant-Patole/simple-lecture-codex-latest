CREATE OR REPLACE FUNCTION public.audit_completed_job_integrity(p_subject_names text[] DEFAULT NULL)
RETURNS TABLE(
  job_id text,
  external_job_id text,
  document_name text,
  subject_name text,
  chapter_number int,
  chapter_title text,
  topic_title text,
  server_ip text,
  video_url text,
  created_at timestamptz,
  completed_at timestamptz,
  is_published boolean,
  has_video_url boolean,
  has_presentation boolean,
  section_count int,
  sections_with_path int,
  kannada_sections_marked int,
  kannada_sections_with_path int,
  integrity_status text,
  reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      j.id::text AS job_id,
      j.external_job_id,
      j.document_name,
      ps.name AS subject_name,
      sc.chapter_number,
      sc.title AS chapter_title,
      st.title AS topic_title,
      j.server_ip,
      j.video_url,
      j.created_at,
      j.completed_at,
      j.is_published,
      j.presentation_json AS pj
    FROM public.video_generation_jobs j
    LEFT JOIN public.ai_assistant_documents d ON d.id = j.document_id
    LEFT JOIN public.subject_chapters sc ON sc.id = d.chapter_id
    LEFT JOIN public.popular_subjects ps ON ps.id = sc.subject_id
    LEFT JOIN public.subject_topics st ON st.id = d.topic_id
    WHERE j.status = 'completed'
      AND (
        p_subject_names IS NULL
        OR cardinality(p_subject_names) = 0
        OR lower(ps.name) = ANY(SELECT lower(x) FROM unnest(p_subject_names) x)
      )
  ),
  section_stats AS (
    SELECT
      s.job_id,
      COALESCE(jsonb_array_length(s.pj->'sections'), 0) AS section_count,
      (
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(COALESCE(s.pj->'sections', '[]'::jsonb)) sec
        WHERE
          COALESCE(sec->>'video_path','') <> ''
          OR COALESCE(sec->>'final_video_path','') <> ''
          OR COALESCE(sec->>'output_path','') <> ''
          OR COALESCE(sec->>'video_url','') <> ''
          OR COALESCE(sec->>'avatar_video_path','') <> ''
      ) AS sections_with_path,
      (
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(COALESCE(s.pj->'sections', '[]'::jsonb)) sec,
             jsonb_array_elements(COALESCE(sec->'avatar_languages', '[]'::jsonb)) a
        WHERE lower(a->>'language') = 'kannada'
          AND lower(COALESCE(a->>'status','')) IN ('completed','ready','success')
      ) AS kannada_sections_marked,
      (
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(COALESCE(s.pj->'sections', '[]'::jsonb)) sec,
             jsonb_array_elements(COALESCE(sec->'avatar_languages', '[]'::jsonb)) a
        WHERE lower(a->>'language') = 'kannada'
          AND lower(COALESCE(a->>'status','')) IN ('completed','ready','success')
          AND (
            COALESCE(a->>'video_path','') <> ''
            OR COALESCE(a->>'output_path','') <> ''
            OR COALESCE(a->>'video_url','') <> ''
            OR COALESCE(a->>'avatar_url','') <> ''
          )
      ) AS kannada_sections_with_path
    FROM scoped s
  )
  SELECT
    s.job_id,
    s.external_job_id,
    s.document_name,
    s.subject_name,
    s.chapter_number,
    s.chapter_title,
    s.topic_title,
    s.server_ip,
    s.video_url,
    s.created_at,
    s.completed_at,
    s.is_published,
    (COALESCE(s.video_url,'') <> '') AS has_video_url,
    (s.pj IS NOT NULL) AS has_presentation,
    ss.section_count,
    ss.sections_with_path,
    ss.kannada_sections_marked,
    ss.kannada_sections_with_path,
    CASE
      WHEN s.pj IS NULL AND COALESCE(s.video_url,'') = '' THEN 'no_presentation'
      WHEN s.pj IS NULL THEN 'no_presentation'
      WHEN ss.section_count = 0 THEN 'empty_presentation'
      WHEN ss.sections_with_path = 0 AND COALESCE(s.video_url,'') = '' THEN 'no_video_path'
      WHEN ss.sections_with_path < ss.section_count THEN 'sections_missing_paths'
      WHEN ss.kannada_sections_marked > 0 AND ss.kannada_sections_with_path < ss.kannada_sections_marked THEN 'kannada_paths_missing'
      ELSE 'valid'
    END AS integrity_status,
    CASE
      WHEN s.pj IS NULL THEN 'Completed but presentation_json is NULL'
      WHEN COALESCE(jsonb_array_length(s.pj->'sections'),0) = 0 THEN 'Presentation has zero sections'
      WHEN ss.sections_with_path = 0 AND COALESCE(s.video_url,'') = '' THEN 'No video URL and no section has a video path'
      WHEN ss.sections_with_path < ss.section_count THEN format('%s of %s sections missing video path', ss.section_count - ss.sections_with_path, ss.section_count)
      WHEN ss.kannada_sections_marked > 0 AND ss.kannada_sections_with_path < ss.kannada_sections_marked THEN format('%s Kannada sections marked completed but missing video path', ss.kannada_sections_marked - ss.kannada_sections_with_path)
      ELSE 'OK'
    END AS reason
  FROM scoped s
  JOIN section_stats ss ON ss.job_id = s.job_id
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_completed_job_integrity(text[]) TO authenticated;