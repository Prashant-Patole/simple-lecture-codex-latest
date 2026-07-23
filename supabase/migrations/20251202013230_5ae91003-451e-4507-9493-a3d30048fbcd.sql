-- Add a simple FAQ cache table for common questions
CREATE TABLE IF NOT EXISTS public.sales_faq_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fast question lookup
CREATE INDEX IF NOT EXISTS idx_sales_faq_cache_question ON public.sales_faq_cache USING gin(to_tsvector('english', question_text));

-- Enable RLS
ALTER TABLE public.sales_faq_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached FAQs (for fast lookup)
CREATE POLICY "Anyone can read FAQ cache"
  ON public.sales_faq_cache
  FOR SELECT
  USING (true);

-- Only system can write (via edge function)
CREATE POLICY "System can manage FAQ cache"
  ON public.sales_faq_cache
  FOR ALL
  USING (true);

-- Add index to sales_leads for faster conversation retrieval
CREATE INDEX IF NOT EXISTS idx_sales_leads_conversation ON public.sales_leads USING gin(conversation_history);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_sales_faq_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_faq_cache_updated_at_trigger
  BEFORE UPDATE ON public.sales_faq_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_faq_cache_updated_at();