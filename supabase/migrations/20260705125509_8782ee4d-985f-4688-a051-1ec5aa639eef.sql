CREATE OR REPLACE FUNCTION public.get_video_generation_coverage_report(p_subject_names text[] DEFAULT NULL::text[])
RETURNS TABLE(
  subject_name text,
  chapter_id uuid,
  chapter_number integer,
  chapter_title text,
  topic_id uuid,
  topic_number integer,
  topic_title text,
  total_jobs integer,
  published_completed_jobs integer,
  latest_status text,
  latest_job_id uuid,
  latest_external_job_id text,
  latest_server_ip text,
  latest_created_at timestamp with time zone,
  coverage_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH requested_subjects AS (
    SELECT lower(btrim(n)) AS name
    FROM unnest(COALESCE(p_subject_names, ARRAY[]::text[])) AS n
  ),
  matched_subjects AS (
    SELECT ps.id, ps.name
    FROM public.popular_subjects ps
    WHERE p_subject_names IS NULL
      OR cardinality(p_subject_names) = 0
      OR EXISTS (
        SELECT 1
        FROM requested_subjects rs
        WHERE lower(ps.name) = rs.name
          OR (rs.name IN ('math', 'maths', 'mathematics') AND lower(ps.name) IN ('math', 'maths', 'mathematics'))
      )
  ),
  topic_jobs AS (
    SELECT
      ps.name AS subject_name,
      sc.id AS chapter_id,
      sc.chapter_number,
      sc.title AS chapter_title,
      st.id AS topic_id,
      st.topic_number,
      st.title AS topic_title,
      j.id AS job_id,
      j.external_job_id,
      j.server_ip,
      j.status,
      j.is_published,
      j.created_at
    FROM matched_subjects ps
    JOIN public.subject_chapters sc ON sc.subject_id = ps.id
    JOIN public.subject_topics st ON st.chapter_id = sc.id
    LEFT JOIN public.ai_assistant_documents d ON d.topic_id = st.id
    LEFT JOIN public.video_generation_jobs j ON j.document_id = d.id
  ),
  agg AS (
    SELECT
      tj.subject_name,
      tj.chapter_id,
      tj.chapter_number,
      tj.chapter_title,
      tj.topic_id,
      tj.topic_number,
      tj.topic_title,
      COUNT(tj.job_id)::int AS total_jobs,
      COUNT(tj.job_id) FILTER (WHERE tj.is_published = true AND tj.status = 'completed')::int AS published_completed_jobs
    FROM topic_jobs tj
    GROUP BY tj.subject_name, tj.chapter_id, tj.chapter_number, tj.chapter_title, tj.topic_id, tj.topic_number, tj.topic_title
  ),
  latest AS (
    SELECT DISTINCT ON (tj.topic_id)
      tj.topic_id,
      tj.job_id,
      tj.external_job_id,
      tj.server_ip,
      tj.status,
      tj.created_at
    FROM topic_jobs tj
    WHERE tj.job_id IS NOT NULL
    ORDER BY tj.topic_id, tj.created_at DESC NULLS LAST
  )
  SELECT
    a.subject_name,
    a.chapter_id,
    a.chapter_number,
    a.chapter_title,
    a.topic_id,
    a.topic_number,
    a.topic_title,
    a.total_jobs,
    a.published_completed_jobs,
    l.status AS latest_status,
    l.job_id AS latest_job_id,
    l.external_job_id AS latest_external_job_id,
    l.server_ip AS latest_server_ip,
    l.created_at AS latest_created_at,
    CASE
      WHEN a.published_completed_jobs > 0 THEN 'ok'
      WHEN a.total_jobs = 0 THEN 'missing'
      WHEN l.status IN ('queued','processing','pending','running') THEN 'in_progress'
      WHEN l.status IN ('failed','error','cancelled') THEN 'failed'
      ELSE 'incomplete'
    END AS coverage_status
  FROM agg a
  LEFT JOIN latest l ON l.topic_id = a.topic_id
  ORDER BY a.subject_name, a.chapter_number NULLS LAST, a.topic_number NULLS LAST, a.topic_title;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_video_generation_coverage_report(text[]) TO authenticated;