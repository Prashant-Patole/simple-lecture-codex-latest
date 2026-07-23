-- Add is_published column to video_generation_jobs
ALTER TABLE video_generation_jobs 
ADD COLUMN is_published BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of published jobs
CREATE INDEX idx_video_generation_jobs_is_published 
ON video_generation_jobs(is_published) 
WHERE is_published = true;

-- Migrate existing published jobs - mark jobs as published if their external_job_id 
-- matches the URL pattern in subject_topics.ai_generated_video_url
UPDATE video_generation_jobs vgj
SET is_published = true
FROM ai_assistant_documents aad
JOIN subject_topics st ON aad.topic_id = st.id
WHERE vgj.document_id = aad.id
  AND vgj.status = 'completed'
  AND st.ai_generated_video_url IS NOT NULL
  AND st.ai_generated_video_url LIKE '%' || vgj.external_job_id || '%';

-- Also mark jobs published for chapters
UPDATE video_generation_jobs vgj
SET is_published = true
FROM ai_assistant_documents aad
JOIN subject_chapters sc ON aad.chapter_id = sc.id
WHERE vgj.document_id = aad.id
  AND vgj.status = 'completed'
  AND sc.ai_generated_video_url IS NOT NULL
  AND sc.ai_generated_video_url LIKE '%' || vgj.external_job_id || '%'
  AND vgj.is_published = false;