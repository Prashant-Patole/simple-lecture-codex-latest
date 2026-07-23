-- Add columns for storing extracted answer text from images
ALTER TABLE student_answers 
ADD COLUMN IF NOT EXISTS extracted_answer_text TEXT,
ADD COLUMN IF NOT EXISTS extraction_confidence TEXT DEFAULT 'pending';