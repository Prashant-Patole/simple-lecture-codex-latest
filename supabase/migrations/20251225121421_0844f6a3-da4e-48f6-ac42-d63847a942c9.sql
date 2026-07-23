-- Add full_content column to store complete parsed JSON
ALTER TABLE public.ai_assistant_documents
ADD COLUMN IF NOT EXISTS full_content JSONB;