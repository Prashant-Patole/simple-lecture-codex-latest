-- Add 'integer' type to question_type and question_format CHECK constraints

-- Drop existing constraints
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_question_format_check;

-- Add new constraints that include 'integer'
ALTER TABLE public.questions ADD CONSTRAINT questions_question_type_check 
  CHECK (question_type IN ('mcq', 'subjective', 'true_false', 'integer'));

ALTER TABLE public.questions ADD CONSTRAINT questions_question_format_check 
  CHECK (question_format IN ('single_choice', 'multiple_choice', 'true_false', 'subjective', 'integer'));