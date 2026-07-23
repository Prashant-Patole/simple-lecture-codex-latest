
-- Auto chapter tests: one row per student × chapter, links to the auto-created self_test
CREATE TABLE public.auto_chapter_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  chapter_title text,
  self_test_id uuid NOT NULL REFERENCES public.self_tests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auto_chapter_tests_unique_student_chapter UNIQUE (student_id, chapter_id)
);

CREATE INDEX idx_auto_chapter_tests_student ON public.auto_chapter_tests(student_id, status);
CREATE INDEX idx_auto_chapter_tests_self_test ON public.auto_chapter_tests(self_test_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_chapter_tests TO authenticated;
GRANT ALL ON public.auto_chapter_tests TO service_role;

ALTER TABLE public.auto_chapter_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own auto chapter tests"
  ON public.auto_chapter_tests FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students update own auto chapter tests"
  ON public.auto_chapter_tests FOR UPDATE TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Admins manage auto chapter tests"
  ON public.auto_chapter_tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: when the linked self_test is submitted, mark the auto_chapter_tests row as submitted too
CREATE OR REPLACE FUNCTION public.sync_auto_chapter_test_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (OLD.submitted_at IS NULL OR OLD.submitted_at <> NEW.submitted_at) THEN
    UPDATE public.auto_chapter_tests
       SET status = 'submitted',
           submitted_at = NEW.submitted_at
     WHERE self_test_id = NEW.id
       AND status <> 'submitted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auto_chapter_test_status ON public.self_tests;
CREATE TRIGGER trg_sync_auto_chapter_test_status
AFTER UPDATE ON public.self_tests
FOR EACH ROW
EXECUTE FUNCTION public.sync_auto_chapter_test_status();
