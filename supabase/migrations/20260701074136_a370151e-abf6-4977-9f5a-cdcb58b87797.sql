CREATE TABLE public.topic_lecture_visibility (
  topic_id uuid PRIMARY KEY REFERENCES public.subject_topics(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'both' CHECK (mode IN ('both','hide_marketing','hide_lecture')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topic_lecture_visibility TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_lecture_visibility TO authenticated;
GRANT ALL ON public.topic_lecture_visibility TO service_role;

ALTER TABLE public.topic_lecture_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view topic lecture visibility"
  ON public.topic_lecture_visibility FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert topic lecture visibility"
  ON public.topic_lecture_visibility FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update topic lecture visibility"
  ON public.topic_lecture_visibility FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete topic lecture visibility"
  ON public.topic_lecture_visibility FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_topic_lecture_visibility_updated_at
  BEFORE UPDATE ON public.topic_lecture_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();