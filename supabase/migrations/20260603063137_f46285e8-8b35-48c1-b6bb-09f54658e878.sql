CREATE TABLE public.reel_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  document_id uuid,
  file_name text,
  job_id text NOT NULL UNIQUE,
  server_ip text,
  target_port int,
  status text NOT NULL DEFAULT 'accepted',
  status_message text,
  progress int NOT NULL DEFAULT 0,
  error text,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_reel_jobs_subject ON public.reel_jobs(subject_id, created_at DESC);
CREATE INDEX idx_reel_jobs_status ON public.reel_jobs(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reel_jobs TO authenticated;
GRANT ALL ON public.reel_jobs TO service_role;

ALTER TABLE public.reel_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reel jobs"
ON public.reel_jobs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert reel jobs"
ON public.reel_jobs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reel jobs"
ON public.reel_jobs FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reel jobs"
ON public.reel_jobs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reel_jobs_updated_at
BEFORE UPDATE ON public.reel_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();