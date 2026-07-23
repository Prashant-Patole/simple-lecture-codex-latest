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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];

    console.log(`[Purchase Reminder] Starting for date: ${today}`);

    // Step 1: Get or generate today's message
    const { data: existingMessage } = await supabase
      .from('purchase_reminder_messages')
      .select('*')
      .eq('message_date', today)
      .maybeSingle();

    let subjectLine: string;
    let messageBody: string;

    if (existingMessage) {
      console.log('[Purchase Reminder] Reusing existing message');
      subjectLine = existingMessage.subject_line;
      messageBody = existingMessage.message_body;
    } else {
      console.log('[Purchase Reminder] Generating new AI message...');
      const randomSeed = Math.floor(Math.random() * 100000) + 1;
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY is not configured');
      }

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are SimpleLecture's marketing assistant. Write a short, compelling email message (3-4 sentences) encouraging a student who has signed up but hasn't enrolled in any course yet. Highlight the benefits of SimpleLecture courses — AI tutoring, expert content, practice questions, live classes. Create urgency but stay warm and friendly. Sign off as "Team SimpleLecture". Also generate a catchy email subject line.

Respond in this exact JSON format:
{"subject_line": "your subject here", "message_body": "your message here"}`,
            },
            {
              role: 'user',
              content: `Generate today's purchase reminder message. Date: ${today}. Random seed: ${randomSeed}. Be unique and different from previous messages.`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('[Purchase Reminder] AI error:', aiResponse.status, errText);
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      let parsed: { subject_line: string; message_body: string };
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found');
        parsed = JSON.parse(jsonMatch[0]);
      } catch (_) {
        parsed = {
          subject_line: '📚 Your courses are waiting for you at SimpleLecture!',
          message_body: content || "You've taken the first step by signing up — now take the next one! Explore our courses designed to help you succeed. With AI-powered tutoring and expert content, we've got everything you need. — Team SimpleLecture",
        };
      }

      subjectLine = parsed.subject_line;
      messageBody = parsed.message_body;

      const { error: insertErr } = await supabase
        .from('purchase_reminder_messages')
        .insert({ message_date: today, subject_line: subjectLine, message_body: messageBody });

      if (insertErr && insertErr.code === '23505') {
        const { data: msg } = await supabase
          .from('purchase_reminder_messages')
          .select('*')
          .eq('message_date', today)
          .single();
        subjectLine = msg!.subject_line;
        messageBody = msg!.message_body;
      } else if (insertErr) {
        throw insertErr;
      }

      console.log('[Purchase Reminder] Message generated:', subjectLine);
    }

    // Step 2: Get all users with emails
    const { data: { users: authUsers }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const usersWithEmails = (authUsers || []).filter((u: any) => u.email);
    if (usersWithEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No users', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Find users with ZERO enrollments
    const userIds = usersWithEmails.map((u: any) => u.id);
    const { data: enrolledUsers } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('is_active', true)
      .in('student_id', userIds);

    const enrolledSet = new Set((enrolledUsers || []).map((e: any) => e.student_id));
    const nonPurchasers = usersWithEmails.filter((u: any) => !enrolledSet.has(u.id));

    console.log(`[Purchase Reminder] ${nonPurchasers.length} users without purchases (${enrolledSet.size} enrolled)`);

    if (nonPurchasers.length === 0) {
      return new Response(JSON.stringify({ message: 'All users have enrolled', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Check who already received today
    const nonPurchaserIds = nonPurchasers.map((u: any) => u.id);
    const { data: alreadySent } = await supabase
      .from('purchase_reminder_email_logs')
      .select('user_id')
      .eq('sent_date', today)
      .in('user_id', nonPurchaserIds);

    const alreadySentIds = new Set((alreadySent || []).map((r: any) => r.user_id));

    // Get profiles for names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', nonPurchaserIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

    const usersToEmail = nonPurchasers
      .filter((u: any) => !alreadySentIds.has(u.id))
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: profileMap.get(u.id) || null,
      }));

    console.log(`[Purchase Reminder] ${usersToEmail.length} users to email`);

    if (usersToEmail.length === 0) {
      return new Response(JSON.stringify({ message: 'All reminders already sent today', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 5: SMTP setup
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

    // Step 6: Send in batches
    const BATCH_SIZE = 10;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < usersToEmail.length; i += BATCH_SIZE) {
      const batch = usersToEmail.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (user: any) => {
          try {
            const userName = user.full_name || 'Student';

            await transporter.sendMail({
              from: '"SimpleLecture" <notifications@simplelecture.com>',
              to: user.email,
              subject: subjectLine,
              html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;">
                  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 24px 24px;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SimpleLecture</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Your courses are waiting! 📚</p>
                  </div>
                  
                  <div style="padding: 36px 30px;">
                    <p style="color: #374151; font-size: 18px; margin: 0 0 8px;">Hi ${userName},</p>
                    
                    <div style="background-color: #f8f7ff; border-left: 4px solid #6366f1; padding: 20px 24px; margin: 24px 0; border-radius: 0 12px 12px 0;">
                      <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0;">
                        ${messageBody}
                      </p>
                    </div>
                    
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="https://simplelecture.com" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                        Browse Courses →
                      </a>
                    </div>
                  </div>
                  
                  <div style="padding: 20px 30px; text-align: center; border-top: 1px solid #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      You're receiving this because you haven't explored our courses yet 💜
                    </p>
                  </div>
                </div>
              `,
            });

            await supabase.from('purchase_reminder_email_logs').insert({
              user_id: user.id,
              email: user.email,
              sent_date: today,
              status: 'sent',
            });

            sentCount++;
          } catch (err: any) {
            console.error(`[Purchase Reminder] Failed for ${user.email}:`, err.message);
            failedCount++;

            await supabase.from('purchase_reminder_email_logs').insert({
              user_id: user.id,
              email: user.email,
              sent_date: today,
              status: 'failed',
              error_message: err.message?.substring(0, 500),
            });
          }
        })
      );

      if (i + BATCH_SIZE < usersToEmail.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[Purchase Reminder] Done! Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({ message: 'Purchase reminder emails processed', sent: sentCount, failed: failedCount, total: usersToEmail.length, subject: subjectLine }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Purchase Reminder] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
