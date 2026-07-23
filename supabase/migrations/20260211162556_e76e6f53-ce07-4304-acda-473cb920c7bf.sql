
CREATE TABLE public.video_job_prefixes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  random_code TEXT NOT NULL UNIQUE,
  full_prefix TEXT NOT NULL,
  subject_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_job_prefixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert prefixes"
  ON public.video_job_prefixes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can select prefixes"
  ON public.video_job_prefixes FOR SELECT
  TO authenticated
  USING (true);
