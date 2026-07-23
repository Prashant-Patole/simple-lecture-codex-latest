-- Add admin policies for enrollments table
CREATE POLICY "Admins manage enrollments"
ON public.enrollments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin policy for batch students view
CREATE POLICY "Admins view all enrollments"
ON public.enrollments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));