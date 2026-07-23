CREATE TABLE public.coverage_analyzer_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  job_id text,
  subject_prefix text,
  publish_action text,
  status text,
  coverage_percent numeric,
  topics_missing jsonb,
  report jsonb,
  log jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_analyzer_reports TO authenticated;
GRANT ALL ON public.coverage_analyzer_reports TO service_role;

ALTER TABLE public.coverage_analyzer_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view coverage reports"
  ON public.coverage_analyzer_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert coverage reports"
  ON public.coverage_analyzer_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coverage reports"
  ON public.coverage_analyzer_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coverage reports"
  ON public.coverage_analyzer_reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cov_reports_subject ON public.coverage_analyzer_reports(subject_prefix);
CREATE INDEX idx_cov_reports_run ON public.coverage_analyzer_reports(run_id);
CREATE INDEX idx_cov_reports_created ON public.coverage_analyzer_reports(created_at DESC);

CREATE TRIGGER trg_cov_reports_updated
  BEFORE UPDATE ON public.coverage_analyzer_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();