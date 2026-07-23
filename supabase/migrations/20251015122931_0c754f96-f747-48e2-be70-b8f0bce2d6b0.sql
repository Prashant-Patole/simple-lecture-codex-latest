-- Add INSERT policy for admins to create teacher profiles
CREATE POLICY "Admins can create teacher profiles"
ON public.teacher_profiles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));