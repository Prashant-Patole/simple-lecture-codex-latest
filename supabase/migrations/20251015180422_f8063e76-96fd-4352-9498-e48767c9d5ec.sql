-- Create function to increment batch student count
CREATE OR REPLACE FUNCTION public.increment_batch_students(batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.batches
  SET current_students = current_students + 1
  WHERE id = batch_id;
END;
$$;

-- Create function to decrement batch student count
CREATE OR REPLACE FUNCTION public.decrement_batch_students(batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.batches
  SET current_students = GREATEST(0, current_students - 1)
  WHERE id = batch_id;
END;
$$;