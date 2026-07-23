-- Add UPDATE policy for dpp_topic_submissions to allow upsert operations
CREATE POLICY "Users can update own dpp submissions" 
ON public.dpp_topic_submissions
FOR UPDATE 
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Make student_id NOT NULL to ensure RLS checks always have valid data
ALTER TABLE public.dpp_topic_submissions 
ALTER COLUMN student_id SET NOT NULL;