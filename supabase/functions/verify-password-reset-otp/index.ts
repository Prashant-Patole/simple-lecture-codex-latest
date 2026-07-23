import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Hash OTP using SHA-256
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a secure reset token
function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, otp_code } = await req.json();
    const json = (body: unknown) => new Response(
      JSON.stringify(body),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    if (!email || !otp_code) {
      return json({ error: 'Please enter the 6-digit code we sent to your email.', code: 'INVALID_OTP' });
    }

    if (!/^\d{6}$/.test(otp_code)) {
      return json({ error: 'Please enter the full 6-digit code.', code: 'INVALID_OTP' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: otpRecord, error: fetchError } = await supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      console.log('OTP record not found for email:', email);
      return json({ error: "That code isn't valid anymore. Please request a new one.", code: 'EXPIRED_OTP' });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('password_reset_otps').delete().eq('id', otpRecord.id);
      return json({ error: 'Your code has expired. Please request a new one.', code: 'EXPIRED_OTP' });
    }

    if (otpRecord.attempts >= 5) {
      await supabase.from('password_reset_otps').delete().eq('id', otpRecord.id);
      return json({ error: 'Too many wrong attempts. Please request a new code.', code: 'TOO_MANY_ATTEMPTS' });
    }

    const providedHash = await hashOTP(otp_code);

    if (providedHash !== otpRecord.otp_hash) {
      await supabase
        .from('password_reset_otps')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      const remaining = 4 - otpRecord.attempts;
      return json({
        error: remaining > 0
          ? `That code doesn't match. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many wrong attempts. Please request a new code.',
        code: 'INVALID_OTP',
      });
    }

    const resetToken = generateResetToken();
    const resetTokenHash = await hashOTP(resetToken);

    const { error: updateError } = await supabase
      .from('password_reset_otps')
      .update({ verified: true, otp_hash: resetTokenHash })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('Error updating OTP record:', updateError);
      return json({ error: "We couldn't verify the code right now. Please try again.", code: 'INTERNAL_ERROR' });
    }

    return json({
      message: 'OTP verified successfully',
      reset_token: resetToken,
      user_id: otpRecord.user_id,
    });

  } catch (error) {
    console.error('Error in verify-password-reset-otp:', error);
    return new Response(
      JSON.stringify({ error: "Something went wrong on our end. Please try again.", code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
