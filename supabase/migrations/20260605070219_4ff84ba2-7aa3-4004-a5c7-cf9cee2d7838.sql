
CREATE TABLE public.published_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_job_id uuid REFERENCES public.reel_jobs(id) ON DELETE CASCADE,
  external_job_id text NOT NULL,
  document_id uuid REFERENCES public.ai_assistant_documents(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  chapter_id uuid,
  topic_id uuid,
  reel_index integer NOT NULL,
  variant text NOT NULL,
  variant_dir text NOT NULL,
  title text,
  video_url text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_job_id, reel_index, variant)
);

CREATE INDEX idx_published_reels_topic ON public.published_reels(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX idx_published_reels_chapter ON public.published_reels(chapter_id) WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_published_reels_subject ON public.published_reels(subject_id);

GRANT SELECT ON public.published_reels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.published_reels TO authenticated;
GRANT ALL ON public.published_reels TO service_role;

ALTER TABLE public.published_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published reels"
  ON public.published_reels FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can insert reels"
  ON public.published_reels FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reels"
  ON public.published_reels FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reels"
  ON public.published_reels FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_published_reels_updated_at
  BEFORE UPDATE ON public.published_reels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
