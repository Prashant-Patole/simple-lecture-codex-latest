
-- 1. self_tests
CREATE TABLE public.self_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('topic','chapter')),
  chapter_ids uuid[] NOT NULL DEFAULT '{}',
  topic_ids uuid[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  total_questions int NOT NULL DEFAULT 0,
  mcq_count int NOT NULL DEFAULT 0,
  written_count int NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  mcq_score numeric,
  percentage numeric,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_tests_student ON public.self_tests(student_id, scheduled_at DESC);

ALTER TABLE public.self_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own self tests" ON public.self_tests
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "admins full self tests" ON public.self_tests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. self_test_questions snapshot
CREATE TABLE public.self_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  self_test_id uuid NOT NULL REFERENCES public.self_tests(id) ON DELETE CASCADE,
  question_id uuid,
  chapter_id uuid,
  topic_id uuid,
  order_number int NOT NULL DEFAULT 0,
  section text NOT NULL CHECK (section IN ('mcq','written')),
  question_text text NOT NULL,
  options jsonb,
  correct_answer text,
  marks int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_test_questions_test ON public.self_test_questions(self_test_id, order_number);

ALTER TABLE public.self_test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own self test questions" ON public.self_test_questions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.self_tests t WHERE t.id = self_test_id AND t.student_id = auth.uid()));

CREATE POLICY "students insert own self test questions" ON public.self_test_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.self_tests t WHERE t.id = self_test_id AND t.student_id = auth.uid()));

CREATE POLICY "admins full self test questions" ON public.self_test_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. self_test_answers
CREATE TABLE public.self_test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  self_test_id uuid NOT NULL REFERENCES public.self_tests(id) ON DELETE CASCADE,
  self_test_question_id uuid NOT NULL REFERENCES public.self_test_questions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  chapter_id uuid,
  topic_id uuid,
  selected_option text,
  answer_text text,
  answer_image_url text,
  is_correct boolean,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(self_test_question_id, student_id)
);

CREATE INDEX idx_self_test_answers_test ON public.self_test_answers(self_test_id);

ALTER TABLE public.self_test_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own self test answers" ON public.self_test_answers
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "admins full self test answers" ON public.self_test_answers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. link from timetable sessions
ALTER TABLE public.study_timetable_sessions
  ADD COLUMN IF NOT EXISTS self_test_id uuid REFERENCES public.self_tests(id) ON DELETE SET NULL;
