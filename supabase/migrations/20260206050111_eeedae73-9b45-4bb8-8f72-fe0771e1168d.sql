-- Drop the current ALL policy 
DROP POLICY IF EXISTS "Admins can manage course thumbnails" ON public.course_thumbnails;

-- Create separate INSERT policy for admins
CREATE POLICY "Admins can insert course thumbnails"
  ON public.course_thumbnails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Create separate UPDATE policy for admins  
CREATE POLICY "Admins can update course thumbnails"
  ON public.course_thumbnails FOR UPDATE
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