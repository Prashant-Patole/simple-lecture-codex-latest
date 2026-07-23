CREATE OR REPLACE FUNCTION public.get_published_lecture_stats(p_subject_id uuid)
RETURNS TABLE(topic_id uuid, lecture_count integer, total_duration_minutes integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.topic_id,
    COUNT(j.id)::int AS lecture_count,
    GREATEST(1, ROUND(SUM(
      (SELECT COALESCE(SUM(
        CASE
          WHEN s->'narration' IS NOT NULL AND s->'narration'->>'total_duration_seconds' IS NOT NULL
          THEN (s->'narration'->>'total_duration_seconds')::numeric
          ELSE 0
        END
      ), 0)
      FROM jsonb_array_elements(j.presentation_json->'sections') s)
    ) / 60)::int) AS total_duration_minutes
  FROM video_generation_jobs j
  JOIN ai_assistant_documents d ON j.document_id = d.id
  WHERE j.is_published = true
    AND j.status = 'completed'
    AND d.subject_id = p_subject_id
    AND d.topic_id IS NOT NULL
    AND j.presentation_json IS NOT NULL
    AND j.presentation_json->'sections' IS NOT NULL
  GROUP BY d.topic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_lecture_stats(uuid) TO authenticated, anon, service_role;