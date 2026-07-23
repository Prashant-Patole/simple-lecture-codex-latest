-- Drop the existing check constraint and add updated one with 'dpp'
ALTER TABLE public.storage_files DROP CONSTRAINT IF EXISTS storage_files_entity_type_check;

ALTER TABLE public.storage_files ADD CONSTRAINT storage_files_entity_type_check 
CHECK (entity_type = ANY (ARRAY['chapter'::text, 'topic'::text, 'subtopic'::text, 'previous_year_paper'::text, 'dpp'::text]));