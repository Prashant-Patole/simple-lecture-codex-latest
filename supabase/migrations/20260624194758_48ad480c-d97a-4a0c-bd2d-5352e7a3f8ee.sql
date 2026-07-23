
CREATE TABLE public.auto_submission_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  subject_name text NOT NULL,
  server_ip text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_index int NOT NULL DEFAULT 0,
  created_by uuid,
  last_tick_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_submission_runs TO authenticated;
GRANT ALL ON public.auto_submission_runs TO service_role;

ALTER TABLE public.auto_submission_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage auto_submission_runs"
  ON public.auto_submission_runs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_auto_submission_runs_updated_at
  BEFORE UPDATE ON public.auto_submission_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_submission_runs;
ALTER TABLE public.auto_submission_runs REPLICA IDENTITY FULL;

CREATE INDEX idx_auto_submission_runs_status ON public.auto_submission_runs(status);
CREATE INDEX idx_auto_submission_runs_subject ON public.auto_submission_runs(subject_id);
