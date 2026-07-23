-- Add subject_id and topic_id columns to scheduled_classes table
ALTER TABLE scheduled_classes 
ADD COLUMN subject_id uuid REFERENCES popular_subjects(id),
ADD COLUMN topic_id uuid REFERENCES subject_topics(id);

-- Add indexes for better query performance
CREATE INDEX idx_scheduled_classes_subject_id ON scheduled_classes(subject_id);
CREATE INDEX idx_scheduled_classes_topic_id ON scheduled_classes(topic_id);