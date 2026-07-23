
CREATE TABLE IF NOT EXISTS public.cdn_presentation_refresh_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'processing',
  job_queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_jobs integer NOT NULL DEFAULT 0,
  current_job_index integer NOT NULL DEFAULT 0,
  completed_jobs integer NOT NULL DEFAULT 0,
  failed_jobs integer NOT NULL DEFAULT 0,
  skipped_jobs integer NOT NULL DEFAULT 0,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.cdn_presentation_refresh_runs TO authenticated;
GRANT ALL ON public.cdn_presentation_refresh_runs TO service_role;

ALTER TABLE public.cdn_presentation_refresh_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view CDN refresh runs"
  ON public.cdn_presentation_refresh_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert CDN refresh runs"
  ON public.cdn_presentation_refresh_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update CDN refresh runs"
  ON public.cdn_presentation_refresh_runs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cdn_pres_refresh_updated_at
  BEFORE UPDATE ON public.cdn_presentation_refresh_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.cdn_presentation_refresh_runs;
