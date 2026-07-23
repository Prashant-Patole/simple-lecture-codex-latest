GRANT SELECT ON public.course_thumbnails TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_thumbnails TO authenticated;
GRANT ALL ON public.course_thumbnails TO service_role;

GRANT SELECT ON public.subject_thumbnails TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_thumbnails TO authenticated;
GRANT ALL ON public.subject_thumbnails TO service_role;

DROP POLICY IF EXISTS "Admins can manage subject thumbnails" ON public.subject_thumbnails;
CREATE POLICY "Admins can manage subject thumbnails"
  ON public.subject_thumbnails
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can manage subject thumbnails" ON public.subject_thumbnails;
CREATE POLICY "Service role can manage subject thumbnails"
  ON public.subject_thumbnails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);