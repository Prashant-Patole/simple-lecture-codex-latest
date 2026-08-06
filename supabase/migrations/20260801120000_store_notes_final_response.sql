ALTER TABLE public.notes_auto_pipeline_items
  ADD COLUMN IF NOT EXISTS final_response_http_status INTEGER,
  ADD COLUMN IF NOT EXISTS final_response JSONB;

CREATE INDEX IF NOT EXISTS notes_auto_pipeline_items_missing_result_idx
  ON public.notes_auto_pipeline_items (created_at)
  WHERE status = 'submitted' AND final_response IS NULL;
