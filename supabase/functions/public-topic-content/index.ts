import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => { // v2
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Parse inputs from query string OR JSON body
    const url = new URL(req.url);
    let subjectRaw = url.searchParams.get('subject') ?? '';
    let chapterRaw = url.searchParams.get('chapter') ?? '';
    let topicRaw = url.searchParams.get('topic') ?? '';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        subjectRaw = body.subject ?? subjectRaw;
        chapterRaw = String(body.chapter ?? chapterRaw);
        topicRaw = String(body.topic ?? topicRaw);
      } catch {
        /* empty body is fine if query string was used */
      }
    }

    const subject = String(subjectRaw).trim();
    const chapter = parseInt(String(chapterRaw).trim(), 10);
    const topic = String(topicRaw).trim();

    if (!subject || !Number.isFinite(chapter) || !topic) {
      return json(400, {
        error: 'Missing/invalid params. Required: subject (string), chapter (int), topic (string).',
        code: 'bad_request',
      });
    }
    if (subject.length > 200 || topic.length > 50) {
      return json(400, { error: 'Input too long', code: 'bad_request' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // 1. Subject by name (case-insensitive), fallback to slug
    let { data: subjectRow } = await supabase
      .from('popular_subjects')
      .select('id, name, slug')
      .ilike('name', subject)
      .maybeSingle();

    if (!subjectRow) {
      const r = await supabase
        .from('popular_subjects')
        .select('id, name, slug')
        .ilike('slug', subject)
        .maybeSingle();
      subjectRow = r.data ?? null;
    }
    if (!subjectRow) {
      return json(404, { error: `Subject not found: ${subject}`, code: 'subject_not_found' });
    }

    // 2. Chapter
    const { data: chapterRow } = await supabase
      .from('subject_chapters')
      .select('id, chapter_number, title')
      .eq('subject_id', subjectRow.id)
      .eq('chapter_number', chapter)
      .maybeSingle();

    if (!chapterRow) {
      return json(404, {
        error: `Chapter ${chapter} not found in subject "${subjectRow.name}"`,
        code: 'chapter_not_found',
      });
    }

    // 3. Topic (topic_number is text)
    const { data: topicRow } = await supabase
      .from('subject_topics')
      .select('id, topic_number, title')
      .eq('chapter_id', chapterRow.id)
      .eq('topic_number', topic)
      .maybeSingle();

    if (!topicRow) {
      return json(404, {
        error: `Topic "${topic}" not found in chapter ${chapter}`,
        code: 'topic_not_found',
      });
    }

    // 4. Parsed document (prefer topic-level, fallback chapter-level)
    let { data: docRow } = await supabase
      .from('ai_assistant_documents')
      .select('id, display_name, source_type, source_url, status, full_content, created_at')
      .eq('topic_id', topicRow.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!docRow) {
      const r = await supabase
        .from('ai_assistant_documents')
        .select('id, display_name, source_type, source_url, status, full_content, created_at')
        .eq('chapter_id', chapterRow.id)
        .is('topic_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      docRow = r.data ?? null;
    }

    // 5. Questions for this topic
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select(
        'id, question_text, question_type, question_format, options, correct_answer, explanation, difficulty, marks, is_verified, is_ai_generated, question_image_url, option_images, chapter_id, topic_id, subtopic_id, source_document_id, source_document_purpose, created_at',
      )

      .eq('topic_id', topicRow.id)
      .order('created_at', { ascending: true });

    if (qErr) {
      return json(500, { error: qErr.message, code: 'questions_query_failed' });
    }

    const response = {
      subject: { id: subjectRow.id, name: subjectRow.name, slug: subjectRow.slug },
      chapter: {
        id: chapterRow.id,
        chapter_number: chapterRow.chapter_number,
        title: chapterRow.title,
      },
      topic: {
        id: topicRow.id,
        topic_number: topicRow.topic_number,
        title: topicRow.title,
      },
      document: docRow
        ? {
            id: docRow.id,
            display_name: docRow.display_name,
            source_type: docRow.source_type,
            source_url: docRow.source_url,
            status: docRow.status,
            created_at: docRow.created_at,
            parsed_json: docRow.full_content,
          }
        : null,
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        question_format: q.question_format,
        options: q.options,
        option_images: q.option_images,
        question_image_url: q.question_image_url,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        marks: q.marks,
        is_verified: q.is_verified,
        is_ai_generated: q.is_ai_generated,
        created_at: q.created_at,
        source: {
          subject_id: subjectRow.id,
          chapter_id: q.chapter_id ?? chapterRow.id,
          topic_id: q.topic_id,
          subtopic_id: q.subtopic_id,
          source_document_id: q.source_document_id,
          source_document_purpose: q.source_document_purpose,
        },
      })),
      counts: { questions: questions?.length ?? 0 },
    };

    return json(200, response);
  } catch (err) {
    console.error('[public-topic-content] error', err);
    return json(500, {
      error: (err as Error)?.message ?? 'Internal error',
      code: 'internal_error',
    });
  }
});
