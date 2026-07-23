CREATE POLICY "Users can create practice tests"
ON public.tests
FOR INSERT
TO authenticated
WITH CHECK (
  test_type = 'practice' 
  AND created_by = auth.uid()
);