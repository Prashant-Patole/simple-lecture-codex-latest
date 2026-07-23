-- Create class_recordings table for storing video recordings with multi-CDN support
CREATE TABLE public.class_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID REFERENCES public.scheduled_classes(id) ON DELETE CASCADE,
  
  -- Source info
  bbb_recording_id TEXT,
  original_filename TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  
  -- B2 Storage (Primary)
  b2_original_path TEXT,
  b2_hls_360p_path TEXT,
  b2_hls_480p_path TEXT,
  b2_hls_720p_path TEXT,
  b2_hls_1080p_path TEXT,
  b2_encrypted_path TEXT,
  
  -- Bunny.net (Optional backup)
  bunny_video_guid TEXT,
  bunny_status TEXT DEFAULT 'pending',
  
  -- Cloudflare CDN
  cloudflare_zone_id TEXT,
  cdn_base_url TEXT,
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  
  -- Quality info
  available_qualities JSONB DEFAULT '[]'::jsonb,
  default_quality TEXT DEFAULT '720p',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create offline_downloads table for tracking encrypted downloads
CREATE TABLE public.offline_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES public.class_recordings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  
  -- Encryption details
  encryption_key_encrypted TEXT,
  encryption_iv TEXT,
  
  -- Download tracking
  quality TEXT DEFAULT '720p',
  file_size_bytes BIGINT,
  download_url TEXT,
  download_status TEXT DEFAULT 'pending',
  downloaded_at TIMESTAMPTZ,
  
  -- Expiry & revocation
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint per user/recording/device
  UNIQUE(recording_id, user_id, device_id)
);

-- Create network_quality_logs table for analytics
CREATE TABLE public.network_quality_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recording_id UUID REFERENCES public.class_recordings(id) ON DELETE SET NULL,
  
  -- Network metrics
  connection_type TEXT,
  effective_bandwidth_mbps DECIMAL(10, 2),
  latency_ms INTEGER,
  
  -- Quality adaptation
  initial_quality TEXT,
  adapted_to_quality TEXT,
  buffer_events INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create video_watch_progress table for resume playback
CREATE TABLE public.video_watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES public.class_recordings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  progress_seconds INTEGER DEFAULT 0,
  progress_percent DECIMAL(5, 2) DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(recording_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_quality_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

-- class_recordings policies
CREATE POLICY "Admins manage recordings" ON public.class_recordings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers view recordings" ON public.class_recordings
  FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Enrolled students view recordings" ON public.class_recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scheduled_classes sc
      JOIN enrollments e ON sc.course_id = e.course_id
      WHERE sc.id = class_recordings.scheduled_class_id
      AND e.student_id = auth.uid()
      AND e.is_active = true
    )
  );

-- offline_downloads policies
CREATE POLICY "Users manage own downloads" ON public.offline_downloads
  FOR ALL USING (auth.uid() = user_id);

-- network_quality_logs policies
CREATE POLICY "Users insert own logs" ON public.network_quality_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all logs" ON public.network_quality_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- video_watch_progress policies
CREATE POLICY "Users manage own progress" ON public.video_watch_progress
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_class_recordings_scheduled_class ON public.class_recordings(scheduled_class_id);
CREATE INDEX idx_class_recordings_status ON public.class_recordings(processing_status);
CREATE INDEX idx_offline_downloads_user ON public.offline_downloads(user_id);
CREATE INDEX idx_offline_downloads_recording ON public.offline_downloads(recording_id);
CREATE INDEX idx_network_quality_logs_user ON public.network_quality_logs(user_id);
CREATE INDEX idx_video_watch_progress_user ON public.video_watch_progress(user_id);

-- Add trigger for updated_at on class_recordings
CREATE TRIGGER update_class_recordings_updated_at
  BEFORE UPDATE ON public.class_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();