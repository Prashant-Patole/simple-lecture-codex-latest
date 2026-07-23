-- Create sales_leads table for AI Sales Assistant
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  conversation_history JSONB DEFAULT '[]'::jsonb,
  lead_status TEXT DEFAULT 'new',
  last_interaction_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create leads (for lead capture)
CREATE POLICY "Anyone can create sales leads"
  ON public.sales_leads
  FOR INSERT
  WITH CHECK (true);

-- Policy: Admins can view all leads
CREATE POLICY "Admins view all sales leads"
  ON public.sales_leads
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins can update leads
CREATE POLICY "Admins manage sales leads"
  ON public.sales_leads
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_leads_email ON public.sales_leads(email);
CREATE INDEX IF NOT EXISTS idx_sales_leads_mobile ON public.sales_leads(mobile);
CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON public.sales_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_created_at ON public.sales_leads(created_at DESC);