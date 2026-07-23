import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Sessions starting in 14-16 minutes from now, no reminder yet, pending
    const nowMs = Date.now();
    const lo = new Date(nowMs + 14 * 60 * 1000).toISOString();
    const hi = new Date(nowMs + 16 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from('study_timetable_sessions')
      .select('id, student_id, course_id, subject_id, title, scheduled_at, duration_minutes')
      .is('reminder_sent_at', null)
      .eq('status', 'pending')
      .gte('scheduled_at', lo)
      .lte('scheduled_at', hi);

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) throw new Error('SMTP not configured');

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const studentIds = [...new Set(sessions.map(s => s.student_id))];
    const courseIds = [...new Set(sessions.map(s => s.course_id))];
    const subjectIds = [...new Set(sessions.map(s => s.subject_id).filter(Boolean))];

    const [{ data: profiles }, { data: courses }, { data: subjects }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name').in('id', studentIds),
      supabase.from('courses').select('id, name').in('id', courseIds),
      subjectIds.length
        ? supabase.from('popular_subjects').select('id, name').in('id', subjectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const courseMap = new Map((courses || []).map(c => [c.id, c]));
    const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s]));

    let sent = 0;
    for (const s of sessions) {
      const profile = profileMap.get(s.student_id);
      if (!profile?.email) continue;
      const course = courseMap.get(s.course_id);
      const subject = s.subject_id ? subjectMap.get(s.subject_id) : null;
      const startTime = new Date(s.scheduled_at).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });

      try {
        await transporter.sendMail({
          from: '"SimpleLecture" <notifications@simplelecture.com>',
          to: profile.email,
          subject: `⏰ Study reminder: ${s.title} starts in 15 minutes`,
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
              <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 24px;text-align:center;border-radius:0 0 24px 24px;">
                <h1 style="color:#fff;margin:0;font-size:26px;">⏰ Time to Study!</h1>
                <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:15px;">Your scheduled session starts in 15 minutes</p>
              </div>
              <div style="padding:32px 24px;">
                <p style="color:#374151;font-size:17px;margin:0 0 16px;">Hi ${profile.full_name || 'Student'},</p>
                <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 20px;">
                  This is a friendly reminder for your study session:
                </p>
                <div style="background:#f8f7ff;border-left:4px solid #6366f1;border-radius:8px;padding:20px;margin:20px 0;">
                  <p style="margin:0 0 8px;color:#1f2937;font-size:18px;font-weight:600;">${s.title}</p>
                  ${course ? `<p style="margin:4px 0;color:#6b7280;font-size:14px;">📘 ${course.name}</p>` : ''}
                  ${subject ? `<p style="margin:4px 0;color:#6b7280;font-size:14px;">📚 ${subject.name}</p>` : ''}
                  <p style="margin:4px 0;color:#6b7280;font-size:14px;">🕒 ${startTime} · ${s.duration_minutes} min</p>
                </div>
                <div style="text-align:center;margin:28px 0;">
                  <a href="https://simplelecture.com/timetable" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Open My Time Table →</a>
                </div>
                <p style="color:#9ca3af;font-size:13px;text-align:center;margin:24px 0 0;">You're doing great. Consistency wins. 💪</p>
              </div>
            </div>
          `,
        });
        await supabase
          .from('study_timetable_sessions')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', s.id);
        sent++;
      } catch (e) {
        console.error('[timetable-reminder] send failed', s.id, e);
      }
    }

    return new Response(JSON.stringify({ processed: sessions.length, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-timetable-reminders]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
