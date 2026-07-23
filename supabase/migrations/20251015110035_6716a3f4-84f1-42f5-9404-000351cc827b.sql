-- Add chapter_id and topic_id to assignments for better linking
ALTER TABLE assignments 
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES subject_chapters(id),
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES subject_topics(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_assignments_chapter ON assignments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_assignments_topic ON assignments(topic_id);