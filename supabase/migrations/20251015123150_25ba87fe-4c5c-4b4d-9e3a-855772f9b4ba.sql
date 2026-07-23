-- Add default UUID generator to teacher_profiles id column
ALTER TABLE public.teacher_profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Also add a DELETE policy for admins
CREATE POLICY "Admins can delete teacher profiles"
ON public.teacher_profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));