
CREATE TABLE public.pyq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.subject_chapters(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.subject_topics(id) ON DELETE SET NULL,
  pyq_type text NOT NULL CHECK (pyq_type IN ('consolidated', 'important', 'predictive')),
  question_text text NOT NULL,
  question_format text NOT NULL DEFAULT 'subjective' CHECK (question_format IN ('mcq', 'subjective', 'true_false')),
  options jsonb,
  marks integer NOT NULL DEFAULT 1,
  difficulty text NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Low', 'Medium', 'Intermediate', 'Advanced')),
  question_image_url text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pyq_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pyq_questions"
  ON public.pyq_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert pyq_questions"
  ON public.pyq_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pyq_questions"
  ON public.pyq_questions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pyq_questions"
  ON public.pyq_questions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pyq_questions_subject_type ON public.pyq_questions(subject_id, pyq_type);
CREATE INDEX idx_pyq_questions_chapter ON public.pyq_questions(chapter_id);
CREATE INDEX idx_pyq_questions_topic ON public.pyq_questions(topic_id);
