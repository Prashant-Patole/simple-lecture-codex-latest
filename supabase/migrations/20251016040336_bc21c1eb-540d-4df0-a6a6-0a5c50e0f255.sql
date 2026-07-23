-- Create enum types for student followups
CREATE TYPE followup_type AS ENUM ('test_reminder', 'live_class_reminder', 'ai_tutorial_prompt', 'general');
CREATE TYPE followup_status AS ENUM ('pending', 'completed', 'dismissed');
CREATE TYPE followup_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE activity_type AS ENUM ('login', 'course_access', 'test_start', 'test_complete', 'ai_query', 'live_class_join', 'assignment_submit');

-- Create student_followups table
CREATE TABLE public.student_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followup_type followup_type NOT NULL,
  status followup_status DEFAULT 'pending',
  priority followup_priority DEFAULT 'medium',
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create student_activity_log table
CREATE TABLE public.student_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_student_followups_student ON student_followups(student_id);
CREATE INDEX idx_student_followups_status ON student_followups(status);
CREATE INDEX idx_student_followups_scheduled ON student_followups(scheduled_for);
CREATE INDEX idx_student_activity_log_student ON student_activity_log(student_id, created_at DESC);
CREATE INDEX idx_student_activity_log_type ON student_activity_log(activity_type);

-- Enhance doubt_logs table with additional columns
ALTER TABLE public.doubt_logs 
ADD COLUMN IF NOT EXISTS conversation_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5);

-- Create materialized view for student analytics
CREATE MATERIALIZED VIEW public.student_analytics_cache AS
SELECT 
  p.id as student_id,
  p.full_name,
  p.avatar_url,
  (SELECT COUNT(DISTINCT e.course_id) FROM enrollments e WHERE e.student_id = p.id) as total_courses,
  (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = p.id AND e.is_active = true) as active_enrollments,
  (SELECT AVG(sp.score) FROM student_progress sp WHERE sp.student_id = p.id AND sp.is_completed = true) as avg_progress_percentage,
  (SELECT COUNT(*) FROM dpt_submissions ds WHERE ds.student_id = p.id) as total_tests_taken,
  (SELECT AVG(ds.score) FROM dpt_submissions ds WHERE ds.student_id = p.id) as avg_test_score,
  (SELECT COUNT(*) FROM assignment_submissions asub WHERE asub.student_id = p.id) as total_assignments_submitted,
  (SELECT COUNT(*) FROM doubt_logs dl WHERE dl.student_id = p.id) as total_ai_interactions,
  (SELECT MAX(sal.created_at) FROM student_activity_log sal WHERE sal.student_id = p.id) as last_active_at,
  now() as refresh_at
FROM profiles p;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_student_analytics_cache_student ON student_analytics_cache(student_id);

-- Enable RLS on new tables
ALTER TABLE public.student_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_followups
CREATE POLICY "Admins manage all followups"
ON public.student_followups
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view own followups"
ON public.student_followups
FOR SELECT
USING (auth.uid() = student_id);

-- RLS Policies for student_activity_log
CREATE POLICY "Admins view all activity logs"
ON public.student_activity_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view own activity logs"
ON public.student_activity_log
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "System can insert activity logs"
ON public.student_activity_log
FOR INSERT
WITH CHECK (true);

-- Create trigger to update student_followups updated_at
CREATE TRIGGER update_student_followups_updated_at
BEFORE UPDATE ON public.student_followups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to refresh student analytics cache
CREATE OR REPLACE FUNCTION public.refresh_student_analytics_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_analytics_cache;
$$;