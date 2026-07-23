-- Create ai_video_watch_logs table for tracking AI video usage
CREATE TABLE public.ai_video_watch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  video_title TEXT NOT NULL,
  subject_id UUID REFERENCES public.popular_subjects(id),
  chapter_id UUID REFERENCES public.subject_chapters(id),
  topic_id UUID REFERENCES public.subject_topics(id),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  completion_percentage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create podcast_listen_logs table for tracking podcast listening
CREATE TABLE public.podcast_listen_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  podcast_title TEXT NOT NULL,
  subject_id UUID REFERENCES public.popular_subjects(id),
  chapter_id UUID REFERENCES public.subject_chapters(id),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  listened_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create daily_activity_logs table for trend tracking
CREATE TABLE public.daily_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_score INTEGER NOT NULL DEFAULT 0,
  live_class_minutes INTEGER DEFAULT 0,
  video_watch_minutes INTEGER DEFAULT 0,
  podcast_listen_minutes INTEGER DEFAULT 0,
  mcq_attempts INTEGER DEFAULT 0,
  doubts_asked INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, activity_date)
);

-- Enable RLS on all new tables
ALTER TABLE public.ai_video_watch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_listen_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_video_watch_logs
CREATE POLICY "Students view own video logs"
ON public.ai_video_watch_logs
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students insert own video logs"
ON public.ai_video_watch_logs
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins manage all video logs"
ON public.ai_video_watch_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for podcast_listen_logs
CREATE POLICY "Students view own podcast logs"
ON public.podcast_listen_logs
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students insert own podcast logs"
ON public.podcast_listen_logs
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins manage all podcast logs"
ON public.podcast_listen_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for daily_activity_logs
CREATE POLICY "Students view own activity logs"
ON public.daily_activity_logs
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students manage own activity logs"
ON public.daily_activity_logs
FOR ALL
USING (auth.uid() = student_id);

CREATE POLICY "Admins manage all activity logs"
ON public.daily_activity_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_ai_video_watch_logs_student ON public.ai_video_watch_logs(student_id);
CREATE INDEX idx_ai_video_watch_logs_created ON public.ai_video_watch_logs(created_at DESC);
CREATE INDEX idx_podcast_listen_logs_student ON public.podcast_listen_logs(student_id);
CREATE INDEX idx_daily_activity_logs_student_date ON public.daily_activity_logs(student_id, activity_date DESC);