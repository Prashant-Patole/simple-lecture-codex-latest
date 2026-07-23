import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CHECKER_URL = 'http://204.12.237.78:5009/api/check';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const jobs = Array.isArray(body?.jobs) ? body.jobs.filter((j: unknown) => typeof j === 'string' && j) : [];
    if (jobs.length === 0) {
      return new Response(JSON.stringify({ error: 'jobs (string[]) required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let upstream: Response;
    try {
      upstream = await fetch(CHECKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();
    let payload: any = {};
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    if (!upstream.ok) {
      // Return 200 so supabase-js doesn't wrap this as a FunctionsHttpError
      return new Response(
        JSON.stringify({ error: 'Upstream failed', upstream_status: upstream.status, details: payload, results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, results: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

