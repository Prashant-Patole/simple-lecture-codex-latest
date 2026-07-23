-- Add foreign key constraint for parsed_questions_pending.approved_by → teacher_profiles.id
ALTER TABLE parsed_questions_pending
ADD CONSTRAINT fk_parsed_questions_pending_approved_by
FOREIGN KEY (approved_by) 
REFERENCES teacher_profiles(id)
ON DELETE SET NULL;

-- Add index for better query performance on approved_by lookups
CREATE INDEX IF NOT EXISTS idx_parsed_questions_pending_approved_by 
ON parsed_questions_pending(approved_by);

-- Add comment for documentation
COMMENT ON CONSTRAINT fk_parsed_questions_pending_approved_by 
ON parsed_questions_pending 
IS 'Links approved_by to the teacher who approved the question';