
CREATE TABLE public.whatsapp_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text text,
  ai_answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_chat_phone ON public.whatsapp_chat_logs(phone_number);
CREATE INDEX idx_wa_chat_student ON public.whatsapp_chat_logs(student_id, created_at DESC);

ALTER TABLE public.whatsapp_chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to whatsapp_chat_logs"
  ON public.whatsapp_chat_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow service role full access to whatsapp_chat_logs"
  ON public.whatsapp_chat_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
