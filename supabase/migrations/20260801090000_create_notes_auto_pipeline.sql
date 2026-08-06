CREATE TABLE IF NOT EXISTS public.notes_auto_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  api_base TEXT NOT NULL DEFAULT 'http://116.202.230.124:8000',
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  current_topic_id UUID REFERENCES public.subject_topics(id) ON DELETE SET NULL,
  stop_requested BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes_auto_pipeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.notes_auto_pipeline_runs(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.subject_chapters(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.subject_topics(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  chapter_number INTEGER,
  chapter_title TEXT,
  topic_number TEXT,
  topic_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'submitted', 'failed', 'stopped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  import_http_status INTEGER,
  import_response JSONB,
  generation_http_status INTEGER,
  generation_response JSONB,
  external_document_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, topic_id),
  UNIQUE (run_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS notes_auto_pipeline_runs_subject_created_idx
  ON public.notes_auto_pipeline_runs (subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notes_auto_pipeline_items_run_sequence_idx
  ON public.notes_auto_pipeline_items (run_id, sequence_order);

CREATE INDEX IF NOT EXISTS notes_auto_pipeline_items_subject_created_idx
  ON public.notes_auto_pipeline_items (subject_id, created_at DESC);

ALTER TABLE public.notes_auto_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_auto_pipeline_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage notes auto pipeline runs"
  ON public.notes_auto_pipeline_runs;
CREATE POLICY "Admins can manage notes auto pipeline runs"
  ON public.notes_auto_pipeline_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage notes auto pipeline items"
  ON public.notes_auto_pipeline_items;
CREATE POLICY "Admins can manage notes auto pipeline items"
  ON public.notes_auto_pipeline_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.claim_notes_auto_pipeline_item()
RETURNS SETOF public.notes_auto_pipeline_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.notes_auto_pipeline_items%ROWTYPE;
BEGIN
  UPDATE public.notes_auto_pipeline_items
  SET
    status = 'failed',
    error_message = 'Server worker timed out while processing this topic.',
    completed_at = now(),
    updated_at = now()
  WHERE status = 'processing'
    AND started_at < now() - interval '15 minutes';

  UPDATE public.notes_auto_pipeline_runs run
  SET
    status = 'failed',
    failed_items = 1,
    error_message = COALESCE(run.error_message, 'A topic worker timed out.'),
    completed_at = now(),
    updated_at = now()
  WHERE run.status = 'running'
    AND EXISTS (
      SELECT 1
      FROM public.notes_auto_pipeline_items item
      WHERE item.run_id = run.id AND item.status = 'failed'
    );

  UPDATE public.notes_auto_pipeline_items item
  SET status = 'stopped', completed_at = now(), updated_at = now()
  FROM public.notes_auto_pipeline_runs run
  WHERE item.run_id = run.id
    AND run.stop_requested = true
    AND item.status = 'queued';

  UPDATE public.notes_auto_pipeline_runs
  SET status = 'stopped', completed_at = now(), updated_at = now()
  WHERE status = 'running' AND stop_requested = true;

  SELECT item.*
  INTO claimed
  FROM public.notes_auto_pipeline_items item
  JOIN public.notes_auto_pipeline_runs run ON run.id = item.run_id
  WHERE run.status = 'running'
    AND run.stop_requested = false
    AND item.status = 'queued'
    AND NOT EXISTS (
      SELECT 1
      FROM public.notes_auto_pipeline_items active
      WHERE active.run_id = run.id AND active.status = 'processing'
    )
  ORDER BY run.created_at, item.sequence_order
  FOR UPDATE OF item SKIP LOCKED
  LIMIT 1;

  IF claimed.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.notes_auto_pipeline_items
  SET
    status = 'processing',
    attempts = attempts + 1,
    started_at = now(),
    updated_at = now()
  WHERE id = claimed.id
  RETURNING * INTO claimed;

  UPDATE public.notes_auto_pipeline_runs
  SET current_topic_id = claimed.topic_id, updated_at = now()
  WHERE id = claimed.run_id;

  RETURN NEXT claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notes_auto_pipeline_item() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notes_auto_pipeline_item() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notes-auto-pipeline-every-minute') THEN
    PERFORM cron.unschedule('notes-auto-pipeline-every-minute');
  END IF;

  PERFORM cron.schedule(
    'notes-auto-pipeline-every-minute',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://oxwhqvsoelqqsblmqkxx.supabase.co/functions/v1/notes-auto-pipeline',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"action":"tick"}'::jsonb,
      timeout_milliseconds := 420000
    );
    $cron$
  );
END $$;
