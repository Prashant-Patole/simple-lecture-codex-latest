-- Drop the old policy that uses has_role() function
DROP POLICY IF EXISTS "Admins can manage course thumbnails" ON public.course_thumbnails;

-- Create new policy with direct EXISTS check (more reliable in RLS context)
CREATE POLICY "Admins can manage course thumbnails"
  ON public.course_thumbnails FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );