-- Delete LLM error response questions and N/A options
DELETE FROM questions 
WHERE 
  -- LLM apologetic/error responses
  question_text ILIKE '%I am sorry%'
  OR question_text ILIKE '%cannot locate question%'
  OR question_text ILIKE '%Please double-check the document%'
  OR question_text ILIKE '%I cannot find%'
  OR question_text ILIKE '%not found in the document%'
  OR question_text ILIKE '%unable to locate%'
  -- All options are N/A
  OR (
    options->'A'->>'text' = 'N/A' 
    AND options->'B'->>'text' = 'N/A' 
    AND options->'C'->>'text' = 'N/A' 
    AND options->'D'->>'text' = 'N/A'
  );