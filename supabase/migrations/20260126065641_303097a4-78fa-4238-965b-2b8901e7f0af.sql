-- Add presentation_json column to video_generation_jobs for storing complete presentation data
ALTER TABLE video_generation_jobs 
ADD COLUMN IF NOT EXISTS presentation_json JSONB;

-- Add ai_presentation_json column to subject_topics for student access
ALTER TABLE subject_topics 
ADD COLUMN IF NOT EXISTS ai_presentation_json JSONB;

-- Add ai_presentation_json column to subject_chapters for student access
ALTER TABLE subject_chapters 
ADD COLUMN IF NOT EXISTS ai_presentation_json JSONB;

-- Add comment for documentation
COMMENT ON COLUMN video_generation_jobs.presentation_json IS 'Complete presentation.json data from external video generation pipeline';
COMMENT ON COLUMN subject_topics.ai_presentation_json IS 'Published AI-generated presentation data for student viewing';
COMMENT ON COLUMN subject_chapters.ai_presentation_json IS 'Published AI-generated presentation data for student viewing';