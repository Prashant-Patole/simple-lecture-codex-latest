import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const ANALYZER_BASE = 'http://204.12.237.78:7860';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden' }, 403);

    const url = new URL(req.url);
    // Path after /coverage-analyzer-proxy → forwarded to analyzer
    const marker = '/coverage-analyzer-proxy';
    const idx = url.pathname.indexOf(marker);
    let forwardPath = idx >= 0 ? url.pathname.slice(idx + marker.length) : '';
    if (!forwardPath.startsWith('/')) forwardPath = '/' + forwardPath;
    if (forwardPath === '/') forwardPath = '/api/health';

    const targetUrl = ANALYZER_BASE + forwardPath + (url.search || '');

    const init: RequestInit = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    let bodyPayload: any = null;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const text = await req.text();
      init.body = text;
      try { bodyPayload = text ? JSON.parse(text) : null; } catch { /* noop */ }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    init.signal = controller.signal;

    const upstream = await fetch(targetUrl, init);
    clearTimeout(timeout);
    const upstreamText = await upstream.text();
    let upstreamJson: any = null;
    try { upstreamJson = upstreamText ? JSON.parse(upstreamText) : null; } catch { /* noop */ }

    // Persist to DB on terminal poll status or new run start
    try {
      // Starting a run: POST /api/analyze → store initial row
      if (req.method === 'POST' && forwardPath === '/api/analyze' && upstreamJson?.run_id) {
        await admin.from('coverage_analyzer_reports').insert({
          run_id: upstreamJson.run_id,
          subject_prefix: bodyPayload?.type ?? null,
          publish_action: bodyPayload?.action ?? 'analyze',
          job_id: Array.isArray(bodyPayload?.job_ids) ? bodyPayload.job_ids.join(',') : null,
          status: 'started',
          report: upstreamJson,
          started_at: new Date().toISOString(),
          created_by: userId,
        });
      }

      // Poll: GET /api/analyze/:runId → on terminal, upsert final row
      if (req.method === 'GET' && forwardPath.startsWith('/api/analyze/') && upstreamJson?.status) {
        const runId = forwardPath.split('/api/analyze/')[1];
        const status = String(upstreamJson.status);
        const isTerminal = ['done', 'failed', 'error', 'completed'].includes(status);
        if (isTerminal && runId) {
          const results = Array.isArray(upstreamJson.results) ? upstreamJson.results : [];
          const first = results[0]?.coverage ?? {};
          await admin.from('coverage_analyzer_reports').update({
            status,
            coverage_percent: first?.coverage_percent ?? null,
            topics_missing: first?.topics_missing ?? null,
            log: upstreamJson.log ?? null,
            report: upstreamJson,
            job_id: Array.isArray(upstreamJson.jobs) ? upstreamJson.jobs.join(',') : null,
            finished_at: upstreamJson.finished_at ?? new Date().toISOString(),
            started_at: upstreamJson.started_at ?? null,
          }).eq('run_id', runId);
        }
      }
    } catch (e) {
      console.error('persist error', e);
    }

    return new Response(upstreamText || '{}', {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('proxy error', e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
