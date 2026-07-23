
CREATE TABLE public.email_otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'signup')),
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_email_otp_email_purpose ON public.email_otp_verifications (email, purpose, verified);
CREATE INDEX idx_email_otp_created_at ON public.email_otp_verifications (created_at);

-- RLS disabled - only accessed by edge functions via service role key
ALTER TABLE public.email_otp_verifications ENABLE ROW LEVEL SECURITY;
