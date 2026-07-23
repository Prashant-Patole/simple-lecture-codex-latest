ALTER TABLE public.auto_submission_runs
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lecture',
  ADD COLUMN IF NOT EXISTS pipeline_config jsonb;

CREATE INDEX IF NOT EXISTS idx_auto_submission_runs_subject_kind
  ON public.auto_submission_runs(subject_id, kind);