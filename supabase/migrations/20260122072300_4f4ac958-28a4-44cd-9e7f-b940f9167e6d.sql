-- Fix existing questions that have NULL source_document_purpose
-- by inferring the correct purpose from their parent paper's document_type
UPDATE questions q
SET source_document_purpose = 
  CASE 
    WHEN p.document_type = 'proficiency' THEN 'proficiency_test'
    WHEN p.document_type = 'mock' THEN 'previous_year'
    WHEN p.document_type = 'practice' THEN 'dpp'
    ELSE 'general'
  END
FROM subject_previous_year_papers p
WHERE q.previous_year_paper_id = p.id
AND (q.source_document_purpose IS NULL OR q.source_document_purpose = '');