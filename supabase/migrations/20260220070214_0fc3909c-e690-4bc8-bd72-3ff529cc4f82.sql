
-- Create language_generation_runs table for server-side bulk language generation
CREATE TABLE public.language_generation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  languages TEXT[] NOT NULL DEFAULT '{}',
  speaker TEXT NOT NULL,
  server_ip TEXT NOT NULL,
  job_queue JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  skipped_jobs INTEGER NOT NULL DEFAULT 0,
  current_job_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.language_generation_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view language generation runs"
ON public.language_generation_runs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert language generation runs"
ON public.language_generation_runs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update language generation runs"
ON public.language_generation_runs FOR UPDATE
TO authenticated
USING (true);

-- Allow service role full access (for the edge function worker)
CREATE POLICY "Service role full access to language generation runs"
ON public.language_generation_runs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_language_generation_runs_updated_at
BEFORE UPDATE ON public.language_generation_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookup of active runs
CREATE INDEX idx_language_generation_runs_status ON public.language_generation_runs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_language_generation_runs_subject ON public.language_generation_runs(subject_id, status);
