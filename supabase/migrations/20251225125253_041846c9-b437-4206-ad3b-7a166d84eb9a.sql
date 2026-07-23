-- Create video_generation_jobs table for storing video generation requests
CREATE TABLE public.video_generation_jobs (
  id VARCHAR(9) PRIMARY KEY,  -- 9-digit unique ID
  document_id UUID REFERENCES public.ai_assistant_documents(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL,
  document_name TEXT,
  parsed_content JSONB,  -- Store the parsed data for API use
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  video_url TEXT,  -- Will be filled when video is ready
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.video_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admins can manage video jobs" ON public.video_generation_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policy for students to view completed videos
CREATE POLICY "Students can view completed videos" ON public.video_generation_jobs
  FOR SELECT TO authenticated
  USING (status = 'completed');

-- Create trigger for updated_at
CREATE TRIGGER update_video_generation_jobs_updated_at
  BEFORE UPDATE ON public.video_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();