CREATE TABLE public.student_lecture_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.subject_chapters(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.subject_topics(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_lecture_notes_context_unique
    UNIQUE NULLS NOT DISTINCT (student_id, job_id, subject_id, chapter_id, topic_id)
);

CREATE INDEX student_lecture_notes_student_updated_idx
  ON public.student_lecture_notes (student_id, updated_at DESC);

ALTER TABLE public.student_lecture_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read their own lecture notes"
  ON public.student_lecture_notes
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create their own lecture notes"
  ON public.student_lecture_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own lecture notes"
  ON public.student_lecture_notes
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can delete their own lecture notes"
  ON public.student_lecture_notes
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER update_student_lecture_notes_updated_at
  BEFORE UPDATE ON public.student_lecture_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_lecture_notes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_lecture_notes;
