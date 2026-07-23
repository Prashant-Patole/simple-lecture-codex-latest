import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'https://esm.sh/nodemailer@6.9.10';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[Daily Motivation] Starting for date: ${today}`);

    // Step 1: Check if today's message already exists
    const { data: existingMessage } = await supabase
      .from('daily_motivation_messages')
      .select('*')
      .eq('message_date', today)
      .maybeSingle();

    let subjectLine: string;
    let messageBody: string;

    if (existingMessage) {
      console.log('[Daily Motivation] Reusing existing message for today');
      subjectLine = existingMessage.subject_line;
      messageBody = existingMessage.message_body;
    } else {
      // Generate new message via Lovable AI
      console.log('[Daily Motivation] Generating new AI message...');
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
              content: `You are SimpleLecture's brand voice. Write a short, warm, inspiring motivational message (3-4 sentences) for students. Each message must be completely original and different. Include a sense of encouragement and emotional connection with the SimpleLecture brand. Sign off warmly as "Team SimpleLecture". Also generate a catchy email subject line.

Respond in this exact JSON format:
{"subject_line": "your subject here", "message_body": "your motivational message here"}`,
            },
            {
              role: 'user',
              content: `Generate today's motivational message. Date: ${today}. Random seed: ${randomSeed}. Do NOT repeat any previous messages.`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('[Daily Motivation] AI gateway error:', aiResponse.status, errText);
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      // Parse JSON from AI response
      let parsed: { subject_line: string; message_body: string };
      try {
        // Try to extract JSON from the response (handle markdown code blocks)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in AI response');
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[Daily Motivation] Failed to parse AI response:', content);
        // Fallback
        parsed = {
          subject_line: '🌟 Your Daily Dose of Motivation from SimpleLecture',
          message_body: content || 'Keep learning, keep growing! Every step you take brings you closer to your goals. We believe in you. — Team SimpleLecture',
        };
      }

      subjectLine = parsed.subject_line;
      messageBody = parsed.message_body;

      // Store today's message
      const { error: insertMsgError } = await supabase
        .from('daily_motivation_messages')
        .insert({
          message_date: today,
          subject_line: subjectLine,
          message_body: messageBody,
        });

      if (insertMsgError) {
        // Unique constraint violation means another instance already created it
        if (insertMsgError.code === '23505') {
          console.log('[Daily Motivation] Message already created by another instance, fetching...');
          const { data: msg } = await supabase
            .from('daily_motivation_messages')
            .select('*')
            .eq('message_date', today)
            .single();
          subjectLine = msg!.subject_line;
          messageBody = msg!.message_body;
        } else {
          throw insertMsgError;
        }
      }

      console.log('[Daily Motivation] Message generated:', subjectLine);
    }

    // Step 2: Query all users with emails from auth.users
    const { data: { users: authUsers }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) throw usersError;

    const usersWithEmails = (authUsers || []).filter((u: any) => u.email);
    if (usersWithEmails.length === 0) {
      console.log('[Daily Motivation] No users with emails found');
      return new Response(JSON.stringify({ message: 'No users to email', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch profiles for full_name personalization
    const userIds = usersWithEmails.map((u: any) => u.id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    const users = usersWithEmails.map((u: any) => ({
      id: u.id,
      email: u.email,
      full_name: profileMap.get(u.id) || null,
    }));

    console.log(`[Daily Motivation] Found ${users.length} users with emails`);

    // Step 3: Check who already received today's email
    const { data: alreadySent } = await supabase
      .from('daily_motivation_email_logs')
      .select('user_id')
      .eq('sent_date', today);

    const alreadySentIds = new Set((alreadySent || []).map((r: any) => r.user_id));
    const usersToEmail = users.filter((u: any) => !alreadySentIds.has(u.id));

    console.log(`[Daily Motivation] ${usersToEmail.length} users remaining (${alreadySentIds.size} already sent)`);

    if (usersToEmail.length === 0) {
      return new Response(JSON.stringify({ message: 'All users already emailed today', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Set up SMTP
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

    // Step 5: Send emails in batches of 10
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
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Your Daily Motivation ✨</p>
                  </div>
                  
                  <div style="padding: 36px 30px;">
                    <p style="color: #374151; font-size: 18px; margin: 0 0 8px;">Hi ${userName},</p>
                    
                    <div style="background-color: #f8f7ff; border-left: 4px solid #6366f1; padding: 20px 24px; margin: 24px 0; border-radius: 0 12px 12px 0;">
                      <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0; font-style: italic;">
                        ${messageBody}
                      </p>
                    </div>
                    
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="https://simplelecture.com" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                        Continue Learning →
                      </a>
                    </div>
                  </div>
                  
                  <div style="padding: 20px 30px; text-align: center; border-top: 1px solid #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      You're receiving this because you're part of the SimpleLecture family 💜
                    </p>
                  </div>
                </div>
              `,
            });

            // Log success
            await supabase.from('daily_motivation_email_logs').insert({
              user_id: user.id,
              email: user.email,
              sent_date: today,
              ai_message: messageBody,
              status: 'sent',
            });

            sentCount++;
          } catch (err: any) {
            console.error(`[Daily Motivation] Failed for ${user.email}:`, err.message);
            failedCount++;

            // Log failure
            await supabase.from('daily_motivation_email_logs').insert({
              user_id: user.id,
              email: user.email,
              sent_date: today,
              ai_message: messageBody,
              status: 'failed',
              error_message: err.message?.substring(0, 500),
            });
          }
        })
      );

      // Delay between batches
      if (i + BATCH_SIZE < usersToEmail.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[Daily Motivation] Done! Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        message: 'Daily motivation emails processed',
        sent: sentCount,
        failed: failedCount,
        total: usersToEmail.length,
        subject: subjectLine,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Daily Motivation] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
