// Generic proxy for the plain-HTTP AI Teaching API (http://116.202.230.124:8000).
// The browser cannot call it directly from the HTTPS preview (mixed content),
// so this function forwards the request server-side.
//
// Usage from the client:
//   POST /functions/v1/ai-teaching-proxy?path=/questions/import&base=http://116.202.230.124:8000
//   GET  /functions/v1/ai-teaching-proxy?path=/pregen/status

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
};

const DEFAULT_BASE = 'http://116.202.230.124:8000';
const ALLOWED_PATH = /^\/[a-zA-Z0-9_\-\/]*$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get('path') || '/';
    const baseParam = url.searchParams.get('base') || DEFAULT_BASE;

    // Allow query string to be embedded inside the `path` param.
    const qIdx = rawPath.indexOf('?');
    const pathOnly = qIdx >= 0 ? rawPath.slice(0, qIdx) : rawPath;
    const embeddedQuery = qIdx >= 0 ? rawPath.slice(qIdx + 1) : '';

    if (!ALLOWED_PATH.test(pathOnly)) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only allow http(s) base URLs
    let upstreamBase: URL;
    try {
      upstreamBase = new URL(baseParam);
      if (!/^https?:$/.test(upstreamBase.protocol)) throw new Error('bad proto');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid base URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Merge any extra query params passed on the proxy URL itself (besides path/base).
    const extraParams = new URLSearchParams();
    for (const [k, v] of url.searchParams.entries()) {
      if (k !== 'path' && k !== 'base') extraParams.append(k, v);
    }
    const extraStr = extraParams.toString();
    const combinedQuery = [embeddedQuery, extraStr].filter(Boolean).join('&');
    const upstreamUrl = `${upstreamBase.origin}${pathOnly}${combinedQuery ? '?' + combinedQuery : ''}`;

    const method = req.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const body = hasBody ? await req.text() : undefined;

    const MAX_ATTEMPTS = method === 'GET' ? 2 : 3;
    let lastErr = 'Upstream fetch failed';
    let lastStatus: number | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 420_000);
      try {
        const upstream = await fetch(upstreamUrl, {
          method,
          headers: { 'Content-Type': req.headers.get('content-type') || 'application/json' },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const text = await upstream.text();
        if (upstream.ok) {
          return new Response(text, {
            status: upstream.status,
            headers: {
              ...corsHeaders,
              'Content-Type': upstream.headers.get('content-type') || 'application/json',
            },
          });
        }
        lastErr = text || `Upstream HTTP ${upstream.status}`;
        lastStatus = upstream.status;
        // Don't retry 4xx (client errors)
        if (upstream.status >= 400 && upstream.status < 500) {
          return new Response(text || JSON.stringify({ error: lastErr }), {
            status: upstream.status,
            headers: {
              ...corsHeaders,
              'Content-Type': upstream.headers.get('content-type') || 'application/json',
            },
          });
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastErr = (err as Error)?.name === 'AbortError'
          ? 'Upstream timed out after 420s'
          : ((err as Error)?.message || 'Upstream fetch failed');
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    return new Response(
      JSON.stringify({ error: lastErr, status: lastStatus, upstream: upstreamUrl }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
