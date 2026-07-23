// Thin proxy to the external AI Teaching Assistant API.
// The upstream is plain HTTP at 116.202.230.124:8000 (CPU primary), so we cannot call it
// directly from the HTTPS browser (mixed-content). This edge function
// forwards the request server-side and returns the response verbatim.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UPSTREAM_URL = 'http://116.202.230.124:8000/ai-teaching-assistant';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode || 'full';

    // Build upstream payload. Map our existing client fields to the
    // upstream contract (mode/question/subjectName/subjectId/language).
    const upstreamBody: Record<string, unknown> = {
      mode,
      question: body?.question ?? body?.questionText ?? '',
      subjectName: body?.subjectName ?? undefined,
      subjectId: body?.subjectId ?? body?.topicId ?? body?.chapterId ?? undefined,
      language: body?.language || 'en-US',
      userTier: body?.userTier || 'pro',
    };

    if (mode === 'doubt') {
      upstreamBody.questionText = body?.questionText;
      upstreamBody.correctAnswer = body?.correctAnswer;
      upstreamBody.studentAnswer = body?.studentAnswer;
    }

    const MAX_ATTEMPTS = 3;
    let lastErrorMessage = 'Upstream fetch failed';
    let lastErrorStatus: number | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 420_000);

      try {
        const upstream = await fetch(UPSTREAM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'pramod2003@@' },
          body: JSON.stringify(upstreamBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await upstream.text();
        if (upstream.ok) {
          if (attempt > 1) {
            console.log(`[ai-teaching-assistant] succeeded on attempt ${attempt}/${MAX_ATTEMPTS}`);
          }
          return new Response(text, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastErrorMessage = text || `Upstream HTTP ${upstream.status}`;
        lastErrorStatus = upstream.status;
        console.warn(
          `[ai-teaching-assistant] attempt ${attempt}/${MAX_ATTEMPTS} non-2xx:`,
          upstream.status,
          lastErrorMessage.substring(0, 300),
        );
      } catch (err) {
        clearTimeout(timeoutId);
        lastErrorMessage = (err as Error)?.name === 'AbortError'
          ? 'Upstream timed out after 420s'
          : ((err as Error)?.message || 'Upstream fetch failed');
        console.warn(
          `[ai-teaching-assistant] attempt ${attempt}/${MAX_ATTEMPTS} error:`,
          lastErrorMessage,
        );
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    console.error(
      '[ai-teaching-assistant] all retries failed:',
      lastErrorStatus,
      lastErrorMessage.substring(0, 500),
    );
    return new Response(
      JSON.stringify({
        error: lastErrorMessage,
        status: lastErrorStatus,
        upstream: UPSTREAM_URL,
        attempts: MAX_ATTEMPTS,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = (err as Error)?.message || 'Unknown error';
    console.error('[ai-teaching-assistant] handler error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
