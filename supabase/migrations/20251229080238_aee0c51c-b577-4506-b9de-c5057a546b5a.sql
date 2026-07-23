-- Add topic_id and chapter_id columns to subject_previous_year_papers table
ALTER TABLE subject_previous_year_papers 
ADD COLUMN chapter_id uuid REFERENCES subject_chapters(id),
ADD COLUMN topic_id uuid REFERENCES subject_topics(id);

-- Add indexes for better query performance
CREATE INDEX idx_previous_year_papers_chapter ON subject_previous_year_papers(chapter_id);
CREATE INDEX idx_previous_year_papers_topic ON subject_previous_year_papers(topic_id);