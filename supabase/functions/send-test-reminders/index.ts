import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SITE_URL = 'https://simplelecture.com';
const FROM = '"SimpleLecture" <notifications@simplelecture.com>';

function fmtIST(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST';
}

function buildHtml(opts: {
  name: string; title: string; whenIST: string;
  duration: number; courseName?: string; subjectName?: string; chapterName?: string;
  windowLabel: '24 hours' | '1 hour';
}) {
  const { name, title, whenIST, duration, courseName, subjectName, chapterName, windowLabel } = opts;
  const meta = [courseName, subjectName, chapterName].filter(Boolean).join(' • ');
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 28px;border-radius:0 0 20px 20px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">⏰ Test reminder — in ${windowLabel}</h1>
    </div>
    <div style="padding:28px;">
      <p style="font-size:16px;color:#374151;margin:0 0 12px;">Hi ${name},</p>
      <p style="font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
        This is a friendly reminder that you scheduled a test on your study timetable.
        It starts in about <strong>${windowLabel}</strong>.
      </p>
      <div style="background:#f8f7ff;border-radius:12px;padding:20px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${title}</p>
        ${meta ? `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${meta}</p>` : ''}
        <p style="margin:0;font-size:14px;color:#374151;"><strong>When:</strong> ${whenIST}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#374151;"><strong>Duration:</strong> ${duration} minutes</p>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${SITE_URL}/study-timetable" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;">
          Open my Study Timetable
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0;">
        You're receiving this because you scheduled a test on your personal SimpleLecture timetable.
      </p>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = Date.now();
    // Look ahead window: anything scheduled within next 25h that is pending and missing at least one reminder
    const horizonStart = new Date(now - 5 * 60 * 1000).toISOString();
    const horizonEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('study_timetable_sessions')
      .select('id, student_id, title, scheduled_at, duration_minutes, course_id, subject_id, chapter_id, reminder_24h_sent_at, reminder_1h_sent_at')
      .eq('session_type', 'test')
      .eq('status', 'pending')
      .gte('scheduled_at', horizonStart)
      .lte('scheduled_at', horizonEnd);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SMTP transporter
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    if (!smtpHost || !smtpUser || !smtpPass) throw new Error('SMTP not configured');

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // Lookup helpers (cached per call)
    const courseCache = new Map<string, string>();
    const subjectCache = new Map<string, string>();
    const chapterCache = new Map<string, string>();
    const userCache = new Map<string, { email: string; name: string }>();

    const getCourse = async (id: string | null) => {
      if (!id) return undefined;
      if (courseCache.has(id)) return courseCache.get(id);
      const { data } = await supabase.from('courses').select('name').eq('id', id).maybeSingle();
      const v = data?.name || '';
      courseCache.set(id, v); return v;
    };
    const getSubject = async (id: string | null) => {
      if (!id) return undefined;
      if (subjectCache.has(id)) return subjectCache.get(id);
      const { data } = await supabase.from('popular_subjects').select('name').eq('id', id).maybeSingle();
      const v = data?.name || '';
      subjectCache.set(id, v); return v;
    };
    const getChapter = async (id: string | null) => {
      if (!id) return undefined;
      if (chapterCache.has(id)) return chapterCache.get(id);
      const { data } = await supabase.from('subject_chapters').select('title').eq('id', id).maybeSingle();
      const v = data?.title || '';
      chapterCache.set(id, v); return v;
    };
    const getUser = async (id: string) => {
      if (userCache.has(id)) return userCache.get(id)!;
      const { data: u } = await supabase.auth.admin.getUserById(id);
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', id).maybeSingle();
      const v = { email: u?.user?.email || '', name: p?.full_name || 'Student' };
      userCache.set(id, v); return v;
    };

    let sent = 0;
    for (const r of rows) {
      const scheduledMs = new Date(r.scheduled_at).getTime();
      const diffMin = (scheduledMs - now) / 60000;

      // 24h window: 23h 45m to 24h 15m before start
      const need24 = !r.reminder_24h_sent_at && diffMin >= 23 * 60 + 45 && diffMin <= 24 * 60 + 15;
      // 1h window: 45m to 75m before start
      const need1 = !r.reminder_1h_sent_at && diffMin >= 45 && diffMin <= 75;

      if (!need24 && !need1) continue;

      const user = await getUser(r.student_id);
      if (!user.email) continue;

      const [courseName, subjectName, chapterName] = await Promise.all([
        getCourse(r.course_id), getSubject(r.subject_id), getChapter(r.chapter_id),
      ]);

      const windowLabel: '24 hours' | '1 hour' = need24 ? '24 hours' : '1 hour';
      const html = buildHtml({
        name: user.name,
        title: r.title,
        whenIST: fmtIST(r.scheduled_at),
        duration: r.duration_minutes,
        courseName, subjectName, chapterName,
        windowLabel,
      });

      try {
        await transporter.sendMail({
          from: FROM,
          to: user.email,
          subject: `⏰ Test reminder: ${r.title} — in ${windowLabel}`,
          html,
        });

        const patch: Record<string, string> = {};
        if (need24) patch.reminder_24h_sent_at = new Date().toISOString();
        if (need1) patch.reminder_1h_sent_at = new Date().toISOString();
        await supabase.from('study_timetable_sessions').update(patch).eq('id', r.id);
        sent++;
      } catch (e) {
        console.error(`[test-reminder] send failed for ${r.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ checked: rows.length, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[test-reminder] fatal:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
