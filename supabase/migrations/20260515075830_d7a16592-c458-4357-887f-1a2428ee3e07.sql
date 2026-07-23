CREATE TABLE public.course_demo_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL UNIQUE REFERENCES public.courses(id) ON DELETE CASCADE,
  video_job_id varchar NOT NULL REFERENCES public.video_generation_jobs(id) ON DELETE CASCADE,
  external_job_id text NOT NULL,
  server_ip text,
  document_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_demo_videos_course ON public.course_demo_videos(course_id);
CREATE INDEX idx_course_demo_videos_external ON public.course_demo_videos(external_job_id);

ALTER TABLE public.course_demo_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read course demo videos"
  ON public.course_demo_videos FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert course demo videos"
  ON public.course_demo_videos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update course demo videos"
  ON public.course_demo_videos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete course demo videos"
  ON public.course_demo_videos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_course_demo_videos_updated_at
  BEFORE UPDATE ON public.course_demo_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();