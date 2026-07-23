
CREATE TABLE public.presentation_update_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  job_queue JSONB DEFAULT '[]'::jsonb,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  skipped_jobs INTEGER NOT NULL DEFAULT 0,
  current_job_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER update_presentation_update_runs_updated_at
  BEFORE UPDATE ON public.presentation_update_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for worker queries
CREATE INDEX idx_presentation_update_runs_status ON public.presentation_update_runs(status);
