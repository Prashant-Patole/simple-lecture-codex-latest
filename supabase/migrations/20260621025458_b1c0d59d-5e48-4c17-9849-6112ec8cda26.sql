
CREATE TABLE IF NOT EXISTS public.pregen_question_cache (
  question_id text PRIMARY KEY,
  subject_id text,
  question_text text,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pregen_question_cache TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pregen_question_cache TO authenticated;
GRANT ALL ON public.pregen_question_cache TO service_role;

ALTER TABLE public.pregen_question_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pregen cache"
  ON public.pregen_question_cache FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert pregen cache"
  ON public.pregen_question_cache FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pregen cache"
  ON public.pregen_question_cache FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pregen cache"
  ON public.pregen_question_cache FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_pregen_question_cache_subject_question
  ON public.pregen_question_cache (subject_id, question_text);

CREATE TRIGGER update_pregen_question_cache_updated_at
  BEFORE UPDATE ON public.pregen_question_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
