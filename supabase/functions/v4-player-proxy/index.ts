import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// V4 player origin — default. Callers can override per-request via
// __ip / __port query params so jobs on other servers (e.g. 69.197.145.4)
// resolve to the right origin instead of returning 404 from the default.
const DEFAULT_ORIGIN_IP = "204.12.237.78";
const DEFAULT_ORIGIN_PORT = "5006";
const CDN_ORIGIN = "https://server1.simplelecture.com/video";
const FUNCTION_PATH = "/v4-player-proxy";

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

const STREAM_CHUNK_BYTES = 1024 * 1024;

function isStreamableMedia(path: string): boolean {
  return /\.(mp4|webm|mp3|wav|ogg)$/i.test(path);
}

function boundRange(rangeHeader: string | null, path: string): string | null {
  if (!rangeHeader || !isStreamableMedia(path)) return rangeHeader;
  const match = rangeHeader.match(/^bytes=(\d+)-$/i);
  if (!match) return rangeHeader;
  const start = Number(match[1]);
  if (!Number.isFinite(start) || start < 0) return rangeHeader;
  return `bytes=${start}-${start + STREAM_CHUNK_BYTES - 1}`;
}

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

function getCdnFallbackUrl(targetPath: string, search: string): string | null {
  const match = targetPath.match(/^\/player\/jobs\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, jobId, filePath] = match;
  return `${CDN_ORIGIN}/${jobId}/${filePath}${search}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let targetPath = url.pathname;
    const fnIndex = targetPath.indexOf(FUNCTION_PATH);
    if (fnIndex !== -1) {
      targetPath = targetPath.substring(fnIndex + FUNCTION_PATH.length);
    }
    if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;

    const upstreamSearch = new URLSearchParams(url.search);
    const rangeFromQuery = upstreamSearch.get("__range");
    upstreamSearch.delete("__range");
    const overrideIp = upstreamSearch.get("__ip");
    const overridePort = upstreamSearch.get("__port");
    upstreamSearch.delete("__ip");
    upstreamSearch.delete("__port");
    const originIp = overrideIp || DEFAULT_ORIGIN_IP;
    const originPort = overridePort || DEFAULT_ORIGIN_PORT;
    const origin = `http://${originIp}:${originPort}`;
    const upstreamQuery = upstreamSearch.toString();
    const upstreamSearchSuffix = upstreamQuery ? `?${upstreamQuery}` : "";
    const targetUrl = `${origin}${targetPath}${upstreamSearchSuffix}`;
    console.log(`[v4-player-proxy] -> ${targetUrl}`);

    const requestedRange = req.headers.get("Range") || req.headers.get("range") || rangeFromQuery;
    const rangeHeader = boundRange(requestedRange, targetPath);
    const headers: Record<string, string> = {};
    if (rangeHeader) headers["Range"] = rangeHeader;
    if (requestedRange || rangeHeader) {
      console.log(`[v4-player-proxy] range requested=${requestedRange || 'none'} upstream=${rangeHeader || 'none'} path=${targetPath}`);
    }

    let response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      const fallbackUrl = getCdnFallbackUrl(targetPath, upstreamSearchSuffix);
      if (fallbackUrl) {
        console.warn(`[v4-player-proxy] origin returned ${response.status}, falling back to CDN: ${fallbackUrl}`);
        response.body?.cancel().catch(() => {});
        response = await fetch(fallbackUrl, { headers });
      }
    }

    const contentType = getContentType(targetPath);
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "X-V4-Requested-Range": requestedRange || "",
      "X-V4-Upstream-Range": rangeHeader || "",
    };

    const cl = response.headers.get("content-length");
    if (cl) responseHeaders["Content-Length"] = cl;
    const cr = response.headers.get("content-range");
    if (cr) responseHeaders["Content-Range"] = cr;
    const ar = response.headers.get("accept-ranges");
    if (ar) responseHeaders["Accept-Ranges"] = ar;

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("v4-player-proxy error:", error);
    return new Response(JSON.stringify({ error: "Proxy error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
