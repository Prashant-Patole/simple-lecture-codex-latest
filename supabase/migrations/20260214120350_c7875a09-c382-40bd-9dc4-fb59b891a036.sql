
-- Create auto_pipeline_runs table for persisting pipeline state
CREATE TABLE public.auto_pipeline_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid NOT NULL,
  subject_name text NOT NULL,
  status text NOT NULL DEFAULT 'building_queue',
  selected_ips jsonb DEFAULT '[]'::jsonb,
  chapters_data jsonb DEFAULT '[]'::jsonb,
  current_chapter_index integer NOT NULL DEFAULT 0,
  total_jobs integer NOT NULL DEFAULT 0,
  completed_jobs integer NOT NULL DEFAULT 0,
  good_jobs integer NOT NULL DEFAULT 0,
  bad_jobs integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.auto_pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own pipeline runs
CREATE POLICY "Users can view all pipeline runs"
  ON public.auto_pipeline_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert pipeline runs"
  ON public.auto_pipeline_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update pipeline runs"
  ON public.auto_pipeline_runs FOR UPDATE
  TO authenticated
  USING (true);

-- Index for quick lookup of active runs by subject
CREATE INDEX idx_auto_pipeline_runs_subject_status
  ON public.auto_pipeline_runs (subject_id, status);

-- Auto-update updated_at
CREATE TRIGGER update_auto_pipeline_runs_updated_at
  BEFORE UPDATE ON public.auto_pipeline_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
