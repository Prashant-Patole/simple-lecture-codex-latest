import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const GAP_BASE = 'http://204.12.237.78:5011';

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

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', claims.claims.sub)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden' }, 403);

    const url = new URL(req.url);
    const marker = '/gap-patcher-proxy';
    const idx = url.pathname.indexOf(marker);
    let forwardPath = idx >= 0 ? url.pathname.slice(idx + marker.length) : '';
    if (!forwardPath.startsWith('/')) forwardPath = '/' + forwardPath;
    if (forwardPath === '/') forwardPath = '/api/health';

    const target = GAP_BASE + forwardPath + (url.search || '');

    const init: RequestInit = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      init.body = await req.text();
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    init.signal = controller.signal;

    const upstream = await fetch(target, init);
    clearTimeout(timeout);
    const text = await upstream.text();
    return new Response(text || '{}', {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('gap-patcher-proxy error', e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
