CREATE OR REPLACE FUNCTION public.get_video_generation_coverage_report(p_subject_names text[] DEFAULT NULL)
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
  latest_created_at timestamptz,
  coverage_status text
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
  WITH topic_jobs AS (
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
    FROM popular_subjects ps
    JOIN subject_chapters sc ON sc.subject_id = ps.id
    JOIN subject_topics st ON st.chapter_id = sc.id
    LEFT JOIN ai_assistant_documents d ON d.topic_id = st.id
    LEFT JOIN video_generation_jobs j ON j.document_id = d.id
    WHERE p_subject_names IS NULL
       OR EXISTS (SELECT 1 FROM unnest(p_subject_names) n WHERE lower(ps.name) = lower(n))
  ),
  agg AS (
    SELECT
      subject_name, chapter_id, chapter_number, chapter_title,
      topic_id, topic_number, topic_title,
      COUNT(job_id)::int AS total_jobs,
      COUNT(job_id) FILTER (WHERE is_published = true AND status = 'completed')::int AS published_completed_jobs
    FROM topic_jobs
    GROUP BY subject_name, chapter_id, chapter_number, chapter_title, topic_id, topic_number, topic_title
  ),
  latest AS (
    SELECT DISTINCT ON (topic_id)
      topic_id, job_id, external_job_id, server_ip, status, created_at
    FROM topic_jobs
    WHERE job_id IS NOT NULL
    ORDER BY topic_id, created_at DESC NULLS LAST
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
$$;