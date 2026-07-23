
CREATE TABLE public.reel_vimeo_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_job_id text NOT NULL,
  reel_index integer NOT NULL DEFAULT 0,
  variant text NOT NULL,
  vimeo_url text NOT NULL,
  vimeo_id text,
  reel_job_id uuid REFERENCES public.reel_jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_job_id, reel_index, variant)
);
GRANT SELECT ON public.reel_vimeo_urls TO authenticated;
GRANT ALL ON public.reel_vimeo_urls TO service_role;
ALTER TABLE public.reel_vimeo_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read vimeo urls" ON public.reel_vimeo_urls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage vimeo urls" ON public.reel_vimeo_urls FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_reel_vimeo_urls_updated BEFORE UPDATE ON public.reel_vimeo_urls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reel_devserver_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_job_id text NOT NULL,
  reel_index integer NOT NULL DEFAULT 0,
  variant text NOT NULL,
  variant_dir text,
  video_url text NOT NULL,
  server_ip text,
  target_port integer,
  reel_job_id uuid REFERENCES public.reel_jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_job_id, reel_index, variant)
);
GRANT SELECT ON public.reel_devserver_urls TO authenticated;
GRANT ALL ON public.reel_devserver_urls TO service_role;
ALTER TABLE public.reel_devserver_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read devserver urls" ON public.reel_devserver_urls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage devserver urls" ON public.reel_devserver_urls FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_reel_devserver_urls_updated BEFORE UPDATE ON public.reel_devserver_urls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
