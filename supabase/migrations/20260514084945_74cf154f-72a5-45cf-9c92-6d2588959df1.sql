SELECT cron.schedule(
  'send-timetable-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oxwhqvsoelqqsblmqkxx.supabase.co/functions/v1/send-timetable-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94d2hxdnNvZWxxcXNibG1xa3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTU4NTgsImV4cCI6MjA3NTA5MTg1OH0.nZbWSb9AQK5uGAQmc7zXAceTHm9GRQJvqkg4-LNo_DM"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);