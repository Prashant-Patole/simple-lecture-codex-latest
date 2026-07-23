
-- O(log n) unique lookup on profiles.email (already unique per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email) WHERE email IS NOT NULL;

-- O(log n) lookup on profiles.phone_number (NOT unique - users can share phones)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles (phone_number) WHERE phone_number IS NOT NULL;

-- Optimize email OTP rate-limit query (email + created_at)
CREATE INDEX IF NOT EXISTS idx_email_otp_rate_limit ON email_otp_verifications (email, created_at);

-- Optimize phone OTP rate-limit query (phone + created_at)
CREATE INDEX IF NOT EXISTS idx_phone_otp_rate_limit ON phone_otp_verifications (phone_number, created_at);

-- Improved composite index for email OTP verify lookups
DROP INDEX IF EXISTS idx_email_otp_email_purpose;
CREATE INDEX idx_email_otp_email_purpose ON email_otp_verifications (email, purpose, verified, expires_at);
