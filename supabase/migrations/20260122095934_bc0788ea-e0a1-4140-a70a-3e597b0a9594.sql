-- Delete all questions that were extracted from uploaded documents
DELETE FROM questions WHERE source_document_id IS NOT NULL;