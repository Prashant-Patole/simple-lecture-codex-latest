-- Add new columns for topic-based recording organization
ALTER TABLE class_recordings 
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id),
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES popular_subjects(id),
ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES subject_chapters(id),
ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES subject_topics(id),
ADD COLUMN IF NOT EXISTS recording_title TEXT,
ADD COLUMN IF NOT EXISTS recording_type TEXT DEFAULT 'class';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_class_recordings_course_id ON class_recordings(course_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_subject_id ON class_recordings(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_chapter_id ON class_recordings(chapter_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_topic_id ON class_recordings(topic_id);

-- Add comment for recording_type field
COMMENT ON COLUMN class_recordings.recording_type IS 'Type of recording: class (from scheduled class) or topic (standalone topic recording)';