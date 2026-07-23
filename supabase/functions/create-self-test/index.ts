import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const MAX_QUESTIONS = 30;

function isMcq(q: any): boolean {
  const fmt = (q.question_format || q.question_type || '').toLowerCase();
  if (fmt === 'mcq' || fmt === 'multiple_choice' || fmt === 'objective') return true;
  if (q.options && typeof q.options === 'object' && Object.keys(q.options).length >= 2) return true;
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      courseId, subjectId, testType,
      chapterIds = [], topicIds = [],
      title, scheduledAt, durationMinutes,
    } = body;

    if (!courseId || !subjectId || !title || !scheduledAt || !durationMinutes) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (testType !== 'topic' && testType !== 'chapter') {
      return new Response(JSON.stringify({ error: 'Invalid testType' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (testType === 'topic' && (!topicIds || topicIds.length === 0)) {
      return new Response(JSON.stringify({ error: 'Pick at least one topic' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (testType === 'chapter' && (!chapterIds || chapterIds.length === 0)) {
      return new Response(JSON.stringify({ error: 'Pick at least one chapter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch questions
    let qQuery = admin.from('questions').select('id, question_text, options, correct_answer, question_format, question_type, marks, chapter_id, topic_id, is_verified');
    if (testType === 'topic') {
      qQuery = qQuery.in('topic_id', topicIds);
    } else {
      qQuery = qQuery.in('chapter_id', chapterIds);
    }
    const { data: allQs, error: qErr } = await qQuery.limit(500);
    if (qErr) throw qErr;

    if (!allQs || allQs.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for the selected scope. Please choose a different topic/chapter.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prefer verified; mix MCQ and written, cap at MAX_QUESTIONS
    const verified = allQs.filter((q: any) => q.is_verified);
    const pool = verified.length >= 5 ? verified : allQs;

    const mcqs = shuffle(pool.filter(isMcq));
    const written = shuffle(pool.filter((q: any) => !isMcq(q)));

    // Aim for ~70% MCQ if possible
    const targetMcq = Math.min(mcqs.length, Math.max(5, Math.round(MAX_QUESTIONS * 0.7)));
    const targetWritten = Math.min(written.length, MAX_QUESTIONS - targetMcq);
    const picked = [
      ...mcqs.slice(0, targetMcq).map((q: any) => ({ ...q, _section: 'mcq' })),
      ...written.slice(0, targetWritten).map((q: any) => ({ ...q, _section: 'written' })),
    ].slice(0, MAX_QUESTIONS);

    if (picked.length === 0) {
      return new Response(JSON.stringify({ error: 'No usable questions in this scope.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mcqCount = picked.filter(p => p._section === 'mcq').length;
    const writtenCount = picked.length - mcqCount;

    // Create self_tests row (RLS via student JWT? use admin with student_id set)
    const { data: test, error: tErr } = await admin
      .from('self_tests')
      .insert({
        student_id: user.id,
        course_id: courseId,
        subject_id: subjectId,
        test_type: testType,
        chapter_ids: chapterIds,
        topic_ids: topicIds,
        title,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        total_questions: picked.length,
        mcq_count: mcqCount,
        written_count: writtenCount,
        status: 'scheduled',
      })
      .select('id')
      .single();
    if (tErr) throw tErr;

    // Snapshot questions (MCQ first then written)
    const snapshot = picked.map((q: any, i: number) => ({
      self_test_id: test.id,
      question_id: q.id,
      chapter_id: q.chapter_id,
      topic_id: q.topic_id,
      order_number: i + 1,
      section: q._section,
      question_text: q.question_text,
      options: q.options ?? null,
      correct_answer: q.correct_answer ?? null,
      marks: q.marks || 1,
    }));
    const { error: sErr } = await admin.from('self_test_questions').insert(snapshot);
    if (sErr) throw sErr;

    // Find or create timetable + session row
    const { data: existingTt } = await admin
      .from('study_timetables')
      .select('id')
      .eq('student_id', user.id)
      .eq('course_id', courseId)
      .eq('mode', 'manual')
      .maybeSingle();

    let timetableId = existingTt?.id;
    if (!timetableId) {
      const { data: newTt, error: ttErr } = await admin
        .from('study_timetables')
        .insert({ student_id: user.id, course_id: courseId, mode: 'manual' })
        .select('id')
        .single();
      if (ttErr) throw ttErr;
      timetableId = newTt.id;
    }

    await admin.from('study_timetable_sessions').insert({
      timetable_id: timetableId,
      student_id: user.id,
      course_id: courseId,
      subject_id: subjectId,
      chapter_id: chapterIds[0] || null,
      title,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      session_type: 'test',
      self_test_id: test.id,
    } as any);

    return new Response(JSON.stringify({ id: test.id, totalQuestions: picked.length, mcqCount, writtenCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[create-self-test]', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
