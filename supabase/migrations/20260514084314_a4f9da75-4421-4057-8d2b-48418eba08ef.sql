
CREATE TABLE public.study_timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('manual','auto')),
  plan_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_timetables_student ON public.study_timetables(student_id, course_id);

ALTER TABLE public.study_timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own timetables"
  ON public.study_timetables FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins manage all timetables"
  ON public.study_timetables FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_study_timetables_updated_at
  BEFORE UPDATE ON public.study_timetables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.study_timetable_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id uuid NOT NULL REFERENCES public.study_timetables(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  subject_id uuid,
  chapter_id uuid,
  topic_id uuid,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  reminder_sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_sessions_student ON public.study_timetable_sessions(student_id, scheduled_at);
CREATE INDEX idx_study_sessions_reminder ON public.study_timetable_sessions(scheduled_at) WHERE reminder_sent_at IS NULL AND status = 'pending';

ALTER TABLE public.study_timetable_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own sessions"
  ON public.study_timetable_sessions FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins manage all sessions"
  ON public.study_timetable_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_study_sessions_updated_at
  BEFORE UPDATE ON public.study_timetable_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
