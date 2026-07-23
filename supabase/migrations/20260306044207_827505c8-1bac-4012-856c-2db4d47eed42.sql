
-- Create page_visits table for visitor tracking
CREATE TABLE public.page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_ip text,
  page_path text NOT NULL,
  user_agent text,
  referrer text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX idx_page_visits_created_at ON public.page_visits(created_at DESC);
CREATE INDEX idx_page_visits_page_path ON public.page_visits(page_path);
CREATE INDEX idx_page_visits_visitor_ip ON public.page_visits(visitor_ip);

-- Enable RLS
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking works for all visitors)
CREATE POLICY "Allow anonymous inserts" ON public.page_visits
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read all visits" ON public.page_visits
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
