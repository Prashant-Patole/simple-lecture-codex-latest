DROP FUNCTION IF EXISTS public.audit_completed_job_integrity(text[]);

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
  has_presentation boolean,
  section_count int,
  english_sections_with_path int,
  kannada_sections_with_path int,
  missing_english_sections int[],
  missing_kannada_sections int[],
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
  sections AS (
    SELECT
      s.job_id,
      COALESCE(NULLIF(sec->>'section_id','')::int, (ord - 1)::int) AS section_id,
      sec
    FROM scoped s,
         LATERAL jsonb_array_elements(COALESCE(s.pj->'sections', '[]'::jsonb))
           WITH ORDINALITY AS t(sec, ord)
  ),
  per_section AS (
    SELECT
      sec.job_id,
      sec.section_id,
      (
        COALESCE(sec.sec->>'avatar_video','') <> ''
        OR COALESCE(sec.sec->>'b2_url','') <> ''
      ) AS has_english,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(sec.sec->'avatar_languages','[]'::jsonb)) a
        WHERE lower(a->>'language') = 'kannada'
          AND (
            COALESCE(a->>'video_path','') <> ''
            OR COALESCE(a->>'b2_url','') <> ''
            OR COALESCE(a->>'vimeo_url','') <> ''
            OR COALESCE(a->>'avatar_url','') <> ''
          )
      ) AS has_kannada
    FROM sections sec
  ),
  agg AS (
    SELECT
      p.job_id,
      COUNT(*)::int AS section_count,
      COUNT(*) FILTER (WHERE p.has_english)::int AS english_sections_with_path,
      COUNT(*) FILTER (WHERE p.has_kannada)::int AS kannada_sections_with_path,
      COALESCE(
        array_agg(p.section_id ORDER BY p.section_id) FILTER (WHERE NOT p.has_english),
        ARRAY[]::int[]
      ) AS missing_english_sections,
      COALESCE(
        array_agg(p.section_id ORDER BY p.section_id) FILTER (WHERE NOT p.has_kannada),
        ARRAY[]::int[]
      ) AS missing_kannada_sections
    FROM per_section p
    GROUP BY p.job_id
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
    (s.pj IS NOT NULL) AS has_presentation,
    COALESCE(a.section_count, 0) AS section_count,
    COALESCE(a.english_sections_with_path, 0) AS english_sections_with_path,
    COALESCE(a.kannada_sections_with_path, 0) AS kannada_sections_with_path,
    COALESCE(a.missing_english_sections, ARRAY[]::int[]) AS missing_english_sections,
    COALESCE(a.missing_kannada_sections, ARRAY[]::int[]) AS missing_kannada_sections,
    CASE
      WHEN s.pj IS NULL THEN 'no_presentation'
      WHEN COALESCE(a.section_count,0) = 0 THEN 'empty_presentation'
      WHEN COALESCE(array_length(a.missing_english_sections,1),0) > 0
        AND COALESCE(array_length(a.missing_kannada_sections,1),0) > 0 THEN 'missing_both'
      WHEN COALESCE(array_length(a.missing_english_sections,1),0) > 0 THEN 'missing_english'
      WHEN COALESCE(array_length(a.missing_kannada_sections,1),0) > 0 THEN 'missing_kannada'
      ELSE 'valid'
    END AS integrity_status,
    CASE
      WHEN s.pj IS NULL THEN 'Completed but presentation_json is NULL'
      WHEN COALESCE(a.section_count,0) = 0 THEN 'Presentation has zero sections'
      WHEN COALESCE(array_length(a.missing_english_sections,1),0) > 0
        AND COALESCE(array_length(a.missing_kannada_sections,1),0) > 0
        THEN format('English missing in sections %s; Kannada missing in sections %s',
                    a.missing_english_sections::text, a.missing_kannada_sections::text)
      WHEN COALESCE(array_length(a.missing_english_sections,1),0) > 0
        THEN format('English avatar_video missing in sections %s', a.missing_english_sections::text)
      WHEN COALESCE(array_length(a.missing_kannada_sections,1),0) > 0
        THEN format('Kannada video_path missing in sections %s', a.missing_kannada_sections::text)
      ELSE 'OK'
    END AS reason
  FROM scoped s
  LEFT JOIN agg a ON a.job_id = s.job_id
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_completed_job_integrity(text[]) TO authenticated;