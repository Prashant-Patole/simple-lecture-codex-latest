// Read-through cache for pre-generated AI teaching answers.
// 1. Check pregen_question_cache
// 2. On miss, call CPU /ai-teaching-assistant
// 3. Upsert response into cache
// 4. Return response

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CPU_BASE = Deno.env.get('AI_TEACHING_CPU_BASE') || 'http://116.202.230.124:8000';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const questionId: string | undefined = body?.questionId;
    const questionText: string | undefined = body?.questionText;
    const subjectId: string | null = body?.subjectId ?? null;
    const subjectName: string | undefined = body?.subjectName;

    if (!questionId || !questionText) {
      return new Response(
        JSON.stringify({ error: 'questionId and questionText are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Cache lookup
    const { data: cached } = await supabase
      .from('pregen_question_cache')
      .select('response_json')
      .eq('question_id', questionId)
      .maybeSingle();

    if (cached?.response_json) {
      const r: any = cached.response_json;
      const looksValid = r && !r.blocked && !r.no_content && !r.error &&
        Array.isArray(r.presentationSlides) && r.presentationSlides.length > 0;
      if (looksValid) {
        return new Response(
          JSON.stringify({ source: 'cache', data: r }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.log('[pregen-answer] ignoring stale non-answer cache row for', questionId);
    }

    // 2. CPU fetch (420s upper bound; cached answers return in ~1s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 420_000);
    let cpuData: any = null;
    try {
      const upstream = await fetch(`${CPU_BASE}/ai-teaching-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'pramod2003@@' },
        body: JSON.stringify({
          mode: 'full',
          question: questionText,
          subjectName,
          subjectId,
          language: 'en-US',
        }),
        signal: controller.signal,
      });
      const text = await upstream.text();
      cpuData = text ? JSON.parse(text) : null;
      if (!upstream.ok) {
        return new Response(
          JSON.stringify({ error: cpuData?.error || `CPU HTTP ${upstream.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // 3. Write-through upsert — ONLY for valid answers.
    // Skip blocked/error/no-content responses so cache never serves garbage.
    const isValidAnswer =
      cpuData &&
      !cpuData.blocked &&
      !cpuData.no_content &&
      !cpuData.error &&
      Array.isArray(cpuData.presentationSlides) &&
      cpuData.presentationSlides.length > 0;

    if (isValidAnswer) {
      try {
        await supabase.from('pregen_question_cache').upsert(
          {
            question_id: questionId,
            subject_id: subjectId,
            question_text: questionText,
            response_json: cpuData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'question_id' },
        );
      } catch (e) {
        console.warn('[pregen-answer] cache write failed (non-fatal):', (e as Error)?.message);
      }
    } else {
      console.log('[pregen-answer] skipping cache write — non-answer response', {
        blocked: cpuData?.blocked, no_content: cpuData?.no_content, error: !!cpuData?.error,
      });
    }

    return new Response(
      JSON.stringify({ source: 'cpu', data: cpuData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
