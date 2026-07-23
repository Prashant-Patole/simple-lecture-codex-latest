
-- Table to store ONE motivational message per day
CREATE TABLE public.daily_motivation_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_date date NOT NULL UNIQUE,
  subject_line text NOT NULL,
  message_body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table to log email sends per user per day
CREATE TABLE public.daily_motivation_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  sent_date date NOT NULL,
  ai_message text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, sent_date)
);

-- RLS
ALTER TABLE public.daily_motivation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_motivation_email_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read these (edge function uses service role key)
CREATE POLICY "Service role full access on daily_motivation_messages"
  ON public.daily_motivation_messages FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on daily_motivation_email_logs"
  ON public.daily_motivation_email_logs FOR ALL
  USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_motivation_logs_sent_date ON public.daily_motivation_email_logs(sent_date);
CREATE INDEX idx_motivation_logs_user_date ON public.daily_motivation_email_logs(user_id, sent_date);
