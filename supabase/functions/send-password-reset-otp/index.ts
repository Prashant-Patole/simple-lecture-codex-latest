import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP using SHA-256
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const json = (body: unknown) => new Response(
      JSON.stringify(body),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    if (!email || typeof email !== 'string') {
      return json({ error: 'Please enter your email address.', code: 'INVALID_EMAIL' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ error: 'Please enter a valid email address.', code: 'INVALID_EMAIL' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return json({ message: 'If an account exists with this email, you will receive an OTP shortly.' });
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log('User not found for email:', email);
      return json({ message: 'If an account exists with this email, you will receive an OTP shortly.' });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentOtps } = await supabase
      .from('password_reset_otps')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', tenMinutesAgo);

    if (recentOtps && recentOtps.length >= 3) {
      return json({ error: 'Too many requests. Please wait a few minutes and try again.', code: 'RATE_LIMITED' });
    }

    await supabase.from('password_reset_otps').delete().eq('user_id', user.id);

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('password_reset_otps')
      .insert({
        user_id: user.id,
        otp_hash: otpHash,
        email: email.toLowerCase(),
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return json({ error: "We couldn't generate a code right now. Please try again in a moment.", code: 'INTERNAL_ERROR' });
    }

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('SMTP credentials not configured');
      return json({ error: "Our email service is temporarily unavailable. Please try again later.", code: 'EMAIL_SEND_FAILED' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: '"SimpleLecture" <notifications@simplelecture.com>',
        to: email,
        subject: 'Reset Your Password - SimpleLecture',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">Password Reset</h1>
            <p style="color: #666; font-size: 16px;">You requested to reset your password. Use the code below to proceed:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 14px;">This code expires in <strong>5 minutes</strong>.</p>
            <p style="color: #999; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">SimpleLecture - AI-Powered Education Platform</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('SMTP send failed:', mailErr);
      return json({ error: "We couldn't send the email right now. Please try again in a minute.", code: 'EMAIL_SEND_FAILED' });
    }

    console.log('Password reset OTP email sent via SMTP to:', email);

    return json({ message: 'If an account exists with this email, you will receive an OTP shortly.' });

  } catch (error) {
    console.error('Error in send-password-reset-otp:', error);
    return new Response(
      JSON.stringify({ error: "Something went wrong on our end. Please try again.", code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
