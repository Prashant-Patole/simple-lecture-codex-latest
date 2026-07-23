-- Add unique constraint on (user_id, question_id) for upsert operations
ALTER TABLE student_answers 
ADD CONSTRAINT student_answers_user_question_unique 
UNIQUE (user_id, question_id);