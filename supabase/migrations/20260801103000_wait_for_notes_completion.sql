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
    error_message = CASE
      WHEN external_document_id IS NULL THEN 'Server worker timed out while submitting this topic.'
      ELSE 'Notes generation did not complete within four hours.'
    END,
    completed_at = now(),
    updated_at = now()
  WHERE status = 'processing'
    AND (
      (external_document_id IS NULL AND started_at < now() - interval '15 minutes')
      OR
      (external_document_id IS NOT NULL AND started_at < now() - interval '4 hours')
    );

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

  -- Keep returning the already-started topic until the remote Notes service finishes it.
  SELECT item.*
  INTO claimed
  FROM public.notes_auto_pipeline_items item
  JOIN public.notes_auto_pipeline_runs run ON run.id = item.run_id
  WHERE run.status = 'running'
    AND run.stop_requested = false
    AND item.status = 'processing'
    AND item.external_document_id IS NOT NULL
  ORDER BY run.created_at, item.sequence_order
  FOR UPDATE OF item SKIP LOCKED
  LIMIT 1;

  IF claimed.id IS NOT NULL THEN
    UPDATE public.notes_auto_pipeline_items
    SET updated_at = now()
    WHERE id = claimed.id
    RETURNING * INTO claimed;
    RETURN NEXT claimed;
    RETURN;
  END IF;

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
