-- Create language_avatar_jobs table for tracking multi-language avatar generation
CREATE TABLE public.language_avatar_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_job_id VARCHAR(9) REFERENCES video_generation_jobs(id) ON DELETE CASCADE,
  external_job_id TEXT,
  section_id INTEGER NOT NULL,
  section_title TEXT,
  language TEXT NOT NULL,
  speaker TEXT DEFAULT 'abhilash',
  task_id TEXT,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_language_avatar_jobs_video_job ON language_avatar_jobs(video_job_id);
CREATE INDEX idx_language_avatar_jobs_status ON language_avatar_jobs(status);

-- Enable Row Level Security
ALTER TABLE language_avatar_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admins
CREATE POLICY "Admins can manage language avatar jobs" 
  ON language_avatar_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_language_avatar_jobs_updated_at
  BEFORE UPDATE ON language_avatar_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();