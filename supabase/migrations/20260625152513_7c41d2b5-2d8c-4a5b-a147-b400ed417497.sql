CREATE OR REPLACE FUNCTION public.claim_auto_submission_run(
  _run_id uuid,
  _cooldown_seconds integer DEFAULT 25
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed boolean := false;
BEGIN
  UPDATE public.auto_submission_runs
  SET last_tick_at = now(),
      updated_at = now()
  WHERE id = _run_id
    AND status = 'running'
    AND (
      last_tick_at IS NULL
      OR last_tick_at < now() - make_interval(secs => _cooldown_seconds)
    )
  RETURNING true INTO _claimed;

  RETURN COALESCE(_claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auto_submission_run(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_auto_submission_run(uuid, integer) TO service_role;