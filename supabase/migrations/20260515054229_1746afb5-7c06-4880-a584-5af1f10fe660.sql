-- Unpublish duplicate lectures in 10th Boards (SSLC – Karnataka), keep newest per topic
WITH csl AS (
  SELECT ps.id AS subject_id
  FROM course_subjects cs JOIN popular_subjects ps ON ps.id = cs.subject_id
  WHERE cs.course_id = '4c10bc8e-acbc-4b76-b7f5-54376c030cb0'
),
ranked AS (
  SELECT j.id,
    ROW_NUMBER() OVER (PARTITION BY d.topic_id ORDER BY j.created_at DESC) AS rn
  FROM video_generation_jobs j
  JOIN ai_assistant_documents d ON d.id = j.document_id
  JOIN subject_topics st ON st.id = d.topic_id
  JOIN subject_chapters sc ON sc.id = st.chapter_id
  WHERE sc.subject_id IN (SELECT subject_id FROM csl)
    AND j.is_published = true
    AND j.status = 'completed'
    AND d.topic_id IS NOT NULL
)
UPDATE video_generation_jobs
SET is_published = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);