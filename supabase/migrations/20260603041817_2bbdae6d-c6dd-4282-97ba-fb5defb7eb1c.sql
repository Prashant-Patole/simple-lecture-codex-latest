ALTER TABLE public.ai_assistant_documents
  ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.ai_assistant_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_status text;

CREATE INDEX IF NOT EXISTS idx_ai_assistant_documents_parent
  ON public.ai_assistant_documents(parent_document_id);