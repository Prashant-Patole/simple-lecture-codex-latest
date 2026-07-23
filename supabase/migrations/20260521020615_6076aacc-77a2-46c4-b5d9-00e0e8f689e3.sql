CREATE TABLE public.course_free_access_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.subject_chapters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (course_id, chapter_id)
);

CREATE INDEX idx_cfa_course ON public.course_free_access_chapters(course_id);
CREATE INDEX idx_cfa_course_subject ON public.course_free_access_chapters(course_id, subject_id);

ALTER TABLE public.course_free_access_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view free-access chapters"
ON public.course_free_access_chapters FOR SELECT
USING (true);

CREATE POLICY "Admins can insert free-access chapters"
ON public.course_free_access_chapters FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update free-access chapters"
ON public.course_free_access_chapters FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete free-access chapters"
ON public.course_free_access_chapters FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));