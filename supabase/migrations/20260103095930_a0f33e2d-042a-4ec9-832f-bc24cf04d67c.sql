-- Fix the specific corrupted question
UPDATE questions 
SET correct_answer = 'True'
WHERE id = 'eb113ec6-1fb9-482a-9729-d673248da9d2';

-- Safety check: Clean any other questions with similar markdown image garbage
UPDATE questions
SET correct_answer = TRIM(REGEXP_REPLACE(
  correct_answer, 
  '\s*\!\[.*?\]\([^)]*\)\s*[^!]*', 
  '', 
  'g'
))
WHERE correct_answer LIKE '%![%';