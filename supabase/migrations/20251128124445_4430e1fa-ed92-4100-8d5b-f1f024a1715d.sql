-- Create topic_videos table for multi-language video support
CREATE TABLE IF NOT EXISTS public.topic_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.subject_topics(id) ON DELETE CASCADE,
  video_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  video_platform TEXT CHECK (video_platform IN ('youtube', 'vimeo')),
  video_id TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX idx_topic_videos_topic_id ON public.topic_videos(topic_id);
CREATE INDEX idx_topic_videos_language ON public.topic_videos(language);

-- Enable RLS
ALTER TABLE public.topic_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins
CREATE POLICY "Admins manage topic videos"
  ON public.topic_videos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active topic videos"
  ON public.topic_videos
  FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_topic_videos_updated_at
  BEFORE UPDATE ON public.topic_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();