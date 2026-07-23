
ALTER TABLE public.study_timetable_sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'study',
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

ALTER TABLE public.study_timetable_sessions
  DROP CONSTRAINT IF EXISTS study_timetable_sessions_session_type_check;
ALTER TABLE public.study_timetable_sessions
  ADD CONSTRAINT study_timetable_sessions_session_type_check
  CHECK (session_type IN ('study','test'));

CREATE INDEX IF NOT EXISTS idx_study_sessions_test_pending
  ON public.study_timetable_sessions (scheduled_at)
  WHERE session_type = 'test' AND status = 'pending';

-- Schedule reminder cron (every 5 minutes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-test-reminders-every-5min') THEN
    PERFORM cron.schedule(
      'send-test-reminders-every-5min',
      '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://oxwhqvsoelqqsblmqkxx.supabase.co/functions/v1/send-test-reminders',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94d2hxdnNvZWxxcXNibG1xa3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTU4NTgsImV4cCI6MjA3NTA5MTg1OH0.nZbWSb9AQK5uGAQmc7zXAceTHm9GRQJvqkg4-LNo_DM"}'::jsonb,
        body := jsonb_build_object('triggered_at', now())
      );
      $cron$
    );
  END IF;
END $$;
