-- Create instructor activity log table for tracking all instructor actions
CREATE TABLE public.instructor_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_instructor_activity_log_instructor_id ON public.instructor_activity_log(instructor_id);
CREATE INDEX idx_instructor_activity_log_created_at ON public.instructor_activity_log(created_at DESC);
CREATE INDEX idx_instructor_activity_log_action_type ON public.instructor_activity_log(action_type);

-- Enable RLS
ALTER TABLE public.instructor_activity_log ENABLE ROW LEVEL SECURITY;

-- Instructors can view their own logs
CREATE POLICY "Instructors view own logs" 
ON public.instructor_activity_log 
FOR SELECT 
USING (auth.uid() = instructor_id);

-- Admins can view all logs
CREATE POLICY "Admins view all activity logs" 
ON public.instructor_activity_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can insert their own logs
CREATE POLICY "Instructors insert own logs" 
ON public.instructor_activity_log 
FOR INSERT 
WITH CHECK (auth.uid() = instructor_id);

-- Admins can manage all logs
CREATE POLICY "Admins manage all activity logs" 
ON public.instructor_activity_log 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));