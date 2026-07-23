import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, email, full_name } = await req.json();

    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: 'user_id and email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userName = full_name || 'Student';

    console.log(`[Welcome Email] Sending to ${email} (${userName})`);

    // Check if already sent
    const { data: existing } = await supabase
      .from('welcome_email_logs')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'sent')
      .maybeSingle();

    if (existing) {
      console.log('[Welcome Email] Already sent to this user, skipping');
      return new Response(JSON.stringify({ message: 'Already sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Set up SMTP
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP credentials not configured');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: '"SimpleLecture" <notifications@simplelecture.com>',
      to: email,
      subject: '🎉 Welcome to SimpleLecture! Your Learning Journey Starts Now',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 24px 24px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">Welcome to SimpleLecture! 🎓</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0; font-size: 16px;">Your gateway to smarter learning</p>
          </div>
          
          <div style="padding: 36px 30px;">
            <p style="color: #374151; font-size: 18px; margin: 0 0 16px;">Hi ${userName},</p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">
              We're thrilled to have you join the SimpleLecture family! 🎉
            </p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
              SimpleLecture is designed to make your learning journey smoother, smarter, and more enjoyable. 
              With AI-powered tutoring, expert-crafted courses, interactive practice, and live classes — 
              everything you need to ace your exams is right here.
            </p>
            
            <div style="background-color: #f8f7ff; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <h3 style="color: #6366f1; margin: 0 0 16px; font-size: 18px;">Here's what you can do:</h3>
              <ul style="color: #4b5563; font-size: 15px; line-height: 2; margin: 0; padding-left: 20px;">
                <li>📚 Browse our expert-designed courses</li>
                <li>🤖 Get instant doubt resolution with AI Tutor</li>
                <li>📝 Practice with thousands of MCQs & DPPs</li>
                <li>🎥 Watch video lectures anytime, anywhere</li>
                <li>📊 Track your progress with detailed analytics</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://simplelecture.com" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 18px; font-weight: 600;">
                Explore Courses →
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0;">
              If you have any questions, our support team is always here to help!
            </p>
          </div>
          
          <div style="padding: 20px 30px; text-align: center; border-top: 1px solid #f3f4f6;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Welcome aboard! 💜 — Team SimpleLecture
            </p>
          </div>
        </div>
      `,
    });

    // Log success
    await supabase.from('welcome_email_logs').insert({
      user_id,
      email,
      status: 'sent',
    });

    console.log(`[Welcome Email] Successfully sent to ${email}`);

    return new Response(JSON.stringify({ message: 'Welcome email sent', email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Welcome Email] Error:', error);

    // Try to log failure
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.user_id) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('welcome_email_logs').insert({
          user_id: body.user_id,
          email: body.email || 'unknown',
          status: 'failed',
          error_message: error.message?.substring(0, 500),
        });
      }
    } catch (_) {}

    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
