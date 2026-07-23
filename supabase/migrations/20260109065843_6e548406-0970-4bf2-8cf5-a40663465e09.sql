-- Add INSERT policy for admins to create scheduled classes
CREATE POLICY "Admins can create scheduled classes"
ON public.scheduled_classes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add SELECT policy for admins to view all scheduled classes
CREATE POLICY "Admins can view all scheduled classes"
ON public.scheduled_classes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete scheduled classes"
ON public.scheduled_classes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));