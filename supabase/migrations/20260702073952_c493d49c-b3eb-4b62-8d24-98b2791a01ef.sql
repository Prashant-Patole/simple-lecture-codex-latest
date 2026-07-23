DROP POLICY IF EXISTS "Users can view active tests" ON public.tests;

CREATE POLICY "Users can view active tests and own practice tests"
ON public.tests
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR (
    test_type = 'practice'
    AND created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);