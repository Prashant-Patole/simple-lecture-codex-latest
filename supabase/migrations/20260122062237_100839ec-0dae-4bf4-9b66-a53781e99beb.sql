-- Delete invalid questions (placeholder text OR all empty options)
DELETE FROM questions 
WHERE 
  -- Type 1: Placeholder text in question
  question_text ILIKE '%This question is not present in the document%'
  OR
  -- Type 2: All options are empty
  (
    options IS NOT NULL
    AND (options->'A'->>'text' IS NULL OR TRIM(options->'A'->>'text') = '')
    AND (options->'B'->>'text' IS NULL OR TRIM(options->'B'->>'text') = '')
    AND (options->'C'->>'text' IS NULL OR TRIM(options->'C'->>'text') = '')
    AND (options->'D'->>'text' IS NULL OR TRIM(options->'D'->>'text') = '')
  );