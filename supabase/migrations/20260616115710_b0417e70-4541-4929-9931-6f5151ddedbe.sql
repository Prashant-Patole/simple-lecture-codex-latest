-- Allow anonymous (public preview) read access to published AI lecture rows
-- so the free-preview player loads DB-cached presentation_json instead of
-- falling back to a stale upstream URL.

-- video_generation_jobs: only published+completed rows visible to anon
CREATE POLICY "Public can view published completed lectures"
  ON public.video_generation_jobs
  FOR SELECT
  TO anon
  USING (is_published = true AND status = 'completed');

GRANT SELECT ON public.video_generation_jobs TO anon;

-- ai_assistant_documents: anon needs to read joined rows for published lectures
CREATE POLICY "Public can view documents linked to published lectures"
  ON public.ai_assistant_documents
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.video_generation_jobs j
      WHERE j.document_id = ai_assistant_documents.id
        AND j.is_published = true
        AND j.status = 'completed'
    )
  );

GRANT SELECT ON public.ai_assistant_documents TO anon;
