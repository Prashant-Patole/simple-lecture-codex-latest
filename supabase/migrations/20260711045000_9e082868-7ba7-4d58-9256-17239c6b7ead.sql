DELETE FROM public.pregen_question_cache
WHERE (response_json->>'blocked')::boolean IS TRUE
   OR (response_json->>'no_content')::boolean IS TRUE
   OR response_json ? 'error'
   OR response_json->'presentationSlides' IS NULL
   OR jsonb_array_length(COALESCE(response_json->'presentationSlides', '[]'::jsonb)) = 0;