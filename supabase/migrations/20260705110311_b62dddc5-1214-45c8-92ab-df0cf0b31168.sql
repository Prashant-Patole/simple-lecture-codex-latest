
-- 1) Queue items
CREATE TABLE public.kannada_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  video_job_id uuid NOT NULL,
  external_job_id text NOT NULL,
  server_ip text NOT NULL,
  subject_name text,
  chapter_number int,
  document_name text,
  total_sections int DEFAULT 0,
  missing_sections int DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  enqueued_by uuid,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kannada_queue_items_active_uniq
  ON public.kannada_queue_items(video_job_id)
  WHERE status IN ('queued','processing');
CREATE INDEX kannada_queue_items_server_status_idx
  ON public.kannada_queue_items(server_ip, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kannada_queue_items TO authenticated;
GRANT ALL ON public.kannada_queue_items TO service_role;
ALTER TABLE public.kannada_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage kannada queue items"
  ON public.kannada_queue_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) Runs
CREATE TABLE public.kannada_queue_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_ip text NOT NULL,
  mode text NOT NULL,
  total int NOT NULL DEFAULT 0,
  completed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kannada_queue_runs TO authenticated;
GRANT ALL ON public.kannada_queue_runs TO service_role;
ALTER TABLE public.kannada_queue_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage kannada queue runs"
  ON public.kannada_queue_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kannada_queue_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kannada_queue_runs;

-- 4) updated_at triggers
CREATE TRIGGER kannada_queue_items_updated
  BEFORE UPDATE ON public.kannada_queue_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER kannada_queue_runs_updated
  BEFORE UPDATE ON public.kannada_queue_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Update scan RPC to accept NULL subject
CREATE OR REPLACE FUNCTION public.get_kannada_coverage_scan(p_subject_name text)
 RETURNS TABLE(job_id text, external_job_id text, document_name text, subject_name text, chapter_number integer, chapter_title text, topic_title text, total_sections integer, kannada_sections integer, coverage_status text, server_ip text, created_at timestamp with time zone)
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
      AND (p_subject_name IS NULL OR lower(ps.name) = lower(p_subject_name))
  )
  SELECT
    s.job_id, s.external_job_id, s.document_name, s.subject_name,
    s.chapter_number, s.chapter_title, s.topic_title,
    s.total_sections, s.kannada_sections,
    CASE
      WHEN s.total_sections = 0 THEN 'missing'
      WHEN s.kannada_sections >= s.total_sections THEN 'full'
      WHEN s.kannada_sections = 0 THEN 'missing'
      ELSE 'partial'
    END AS coverage_status,
    s.server_ip, s.created_at
  FROM scanned s
  ORDER BY s.subject_name, s.chapter_number NULLS LAST, s.chapter_title, s.topic_title, s.document_name;
END;
$function$;
