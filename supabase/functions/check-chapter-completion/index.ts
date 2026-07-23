import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const { chapterId, courseId, subjectId } = await req.json();
    if (!chapterId || !courseId || !subjectId) {
      return new Response(JSON.stringify({ error: 'Missing chapterId / courseId / subjectId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Idempotency — already triggered for this chapter
    const { data: existing } = await admin
      .from('auto_chapter_tests')
      .select('id, self_test_id, chapter_title, status')
      .eq('student_id', user.id)
      .eq('chapter_id', chapterId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        completed: true,
        alreadyExisted: true,
        selfTestId: existing.self_test_id,
        chapterTitle: existing.chapter_title,
        status: existing.status,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2) Chapter info + topics
    const { data: chapter, error: chapErr } = await admin
      .from('subject_chapters')
      .select('id, title')
      .eq('id', chapterId)
      .maybeSingle();
    if (chapErr || !chapter) {
      return new Response(JSON.stringify({ error: 'Chapter not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: topics } = await admin
      .from('subject_topics')
      .select('id, title')
      .eq('chapter_id', chapterId);

    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ completed: false, reason: 'no_topics' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const topicIds = topics.map((t) => t.id);

    // 3) Topics that have at least one published lecture (only these are "required" to watch)
    const { data: publishedDocs } = await admin
      .from('ai_assistant_documents')
      .select('topic_id, video_generation_jobs!inner(id, is_published, status)')
      .in('topic_id', topicIds)
      .eq('video_generation_jobs.is_published', true)
      .eq('video_generation_jobs.status', 'completed');

    const requiredTopicIds = new Set<string>();
    for (const d of (publishedDocs || []) as any[]) {
      if (d.topic_id) requiredTopicIds.add(d.topic_id);
    }

    if (requiredTopicIds.size === 0) {
      return new Response(JSON.stringify({ completed: false, reason: 'no_published_lectures' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Student's watch logs for this chapter's topics
    const { data: watchLogs } = await admin
      .from('ai_video_watch_logs')
      .select('topic_id')
      .eq('student_id', user.id)
      .in('topic_id', Array.from(requiredTopicIds));

    const watchedTopicIds = new Set<string>((watchLogs || []).map((w: any) => w.topic_id).filter(Boolean));

    // 5) Every required topic must be watched
    for (const tid of requiredTopicIds) {
      if (!watchedTopicIds.has(tid)) {
        return new Response(JSON.stringify({
          completed: false,
          reason: 'topic_not_watched',
          topicId: tid,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 6) All good — invoke create-self-test with the student's JWT
    const title = `Chapter Test – ${chapter.title}`;
    const csRes = await fetch(`${supabaseUrl}/functions/v1/create-self-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({
        courseId,
        subjectId,
        testType: 'chapter',
        chapterIds: [chapterId],
        topicIds: [],
        title,
        scheduledAt: new Date().toISOString(),
        durationMinutes: 180,
      }),
    });

    const csJson = await csRes.json().catch(() => ({}));
    if (!csRes.ok || !csJson?.id) {
      return new Response(JSON.stringify({
        completed: false,
        reason: 'create_self_test_failed',
        detail: csJson,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 7) Bind in auto_chapter_tests (idempotent via UNIQUE constraint)
    const { data: bound, error: bindErr } = await admin
      .from('auto_chapter_tests')
      .upsert({
        student_id: user.id,
        course_id: courseId,
        subject_id: subjectId,
        chapter_id: chapterId,
        chapter_title: chapter.title,
        self_test_id: csJson.id,
        status: 'pending',
      }, { onConflict: 'student_id,chapter_id' })
      .select('self_test_id, chapter_title')
      .single();

    if (bindErr) {
      console.error('[check-chapter-completion] bind error', bindErr);
    }

    return new Response(JSON.stringify({
      completed: true,
      alreadyExisted: false,
      selfTestId: bound?.self_test_id || csJson.id,
      chapterTitle: bound?.chapter_title || chapter.title,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[check-chapter-completion]', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
