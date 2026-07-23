-- Create table to track AI assistant document uploads
CREATE TABLE public.ai_assistant_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
  display_name TEXT,
  source_type TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'json', 'url'
  source_url TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'completed',
  content_preview TEXT, -- First 500 chars of content
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by subject
CREATE INDEX idx_ai_assistant_documents_subject_id ON public.ai_assistant_documents(subject_id);

-- Enable RLS
ALTER TABLE public.ai_assistant_documents ENABLE ROW LEVEL SECURITY;

-- Admins can manage all documents
CREATE POLICY "Admins manage AI assistant documents"
  ON public.ai_assistant_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view documents (for AI assistant access)
CREATE POLICY "Anyone can view AI assistant documents"
  ON public.ai_assistant_documents
  FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_assistant_documents_updated_at
  BEFORE UPDATE ON public.ai_assistant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();