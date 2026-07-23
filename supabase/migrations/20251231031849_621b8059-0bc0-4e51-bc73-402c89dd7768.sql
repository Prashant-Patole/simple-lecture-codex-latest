-- Add chapter_id and topic_id columns to ai_assistant_documents
ALTER TABLE ai_assistant_documents 
ADD COLUMN chapter_id UUID REFERENCES subject_chapters(id) ON DELETE SET NULL,
ADD COLUMN topic_id UUID REFERENCES subject_topics(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX idx_ai_assistant_documents_chapter_id ON ai_assistant_documents(chapter_id);
CREATE INDEX idx_ai_assistant_documents_topic_id ON ai_assistant_documents(topic_id);