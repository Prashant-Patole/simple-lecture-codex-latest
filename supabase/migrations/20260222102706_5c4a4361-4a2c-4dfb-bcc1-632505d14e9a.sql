
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table: welcome_email_logs
CREATE TABLE public.welcome_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: purchase_reminder_email_logs
CREATE TABLE public.purchase_reminder_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  email TEXT NOT NULL,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, sent_date)
);

-- Table: purchase_reminder_messages
CREATE TABLE public.purchase_reminder_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_date DATE NOT NULL UNIQUE,
  subject_line TEXT NOT NULL,
  message_body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger function to call send-welcome-email on new profile
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email TEXT;
  v_full_name TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  
  v_full_name := COALESCE(NEW.full_name, 'Student');
  
  IF v_email IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://oxwhqvsoelqqsblmqkxx.supabase.co/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94d2hxdnNvZWxxcXNibG1xa3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTU4NTgsImV4cCI6MjA3NTA5MTg1OH0.nZbWSb9AQK5uGAQmc7zXAceTHm9GRQJvqkg4-LNo_DM'
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'email', v_email,
        'full_name', v_full_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
CREATE TRIGGER on_profile_created_send_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_email();

-- RLS policies (service role access only for these log tables)
ALTER TABLE public.welcome_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_reminder_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_reminder_messages ENABLE ROW LEVEL SECURITY;
