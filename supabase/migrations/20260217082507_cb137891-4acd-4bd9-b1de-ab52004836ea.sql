
CREATE TABLE public.phone_otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.phone_otp_verifications ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_phone_otp_phone_purpose ON public.phone_otp_verifications (phone_number, purpose, verified, expires_at);
