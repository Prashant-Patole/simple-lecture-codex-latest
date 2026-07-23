UPDATE public.kannada_queue_items q
SET topic_title = st.title
FROM public.video_generation_jobs j
JOIN public.ai_assistant_documents d ON d.id = j.document_id
JOIN public.subject_topics st ON st.id = d.topic_id
WHERE q.video_job_id = j.id::text
  AND (q.topic_title IS NULL OR q.topic_title = '');