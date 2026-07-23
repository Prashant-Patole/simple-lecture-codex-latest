-- Create regeneration_tasks table for persistent tracking
CREATE TABLE public.regeneration_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_job_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  section_ids INTEGER[],
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.regeneration_tasks ENABLE ROW LEVEL SECURITY;

-- Indexes for fast lookup
CREATE INDEX idx_regen_tasks_job ON public.regeneration_tasks(external_job_id);
CREATE INDEX idx_regen_tasks_status ON public.regeneration_tasks(status);
CREATE INDEX idx_regen_tasks_started ON public.regeneration_tasks(started_at DESC);

-- RLS Policies: Admins can do everything
CREATE POLICY "Admins can view all regeneration tasks"
ON public.regeneration_tasks FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert regeneration tasks"
ON public.regeneration_tasks FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update regeneration tasks"
ON public.regeneration_tasks FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete regeneration tasks"
ON public.regeneration_tasks FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_regeneration_tasks_updated_at
BEFORE UPDATE ON public.regeneration_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();