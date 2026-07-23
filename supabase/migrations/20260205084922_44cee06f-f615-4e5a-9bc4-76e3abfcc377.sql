-- Change topic_number and sequence_order from INTEGER to NUMERIC to support decimal values like 1.1, 1.2
ALTER TABLE public.subject_topics 
  ALTER COLUMN topic_number TYPE numeric USING topic_number::numeric;

ALTER TABLE public.subject_topics 
  ALTER COLUMN sequence_order TYPE numeric USING sequence_order::numeric;