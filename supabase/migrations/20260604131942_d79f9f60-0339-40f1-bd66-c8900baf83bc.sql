
UPDATE public.video_generation_jobs
SET is_published = true, updated_at = now()
WHERE id IN (
  SELECT j.id
  FROM public.video_generation_jobs j
  JOIN public.ai_assistant_documents d ON d.id = j.document_id
  WHERE d.subject_id = 'b4b83f9b-bc1f-433c-9400-234e50ac1b70'
    AND j.created_at >= '2026-06-01'
    AND j.status = 'completed'
    AND (j.error_message IS NULL OR j.error_message = '')
    AND j.is_published = false
);
