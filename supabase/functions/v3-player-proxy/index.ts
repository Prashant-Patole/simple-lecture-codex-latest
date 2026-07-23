import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ORIGIN = "http://69.197.145.4:5006";
const CDN_ORIGIN = "https://server1.simplelecture.com/video";
const FUNCTION_PATH = "/v3-player-proxy";

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
};

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
    // Strip the function base path to get the target path
    let targetPath = url.pathname;
    const fnIndex = targetPath.indexOf(FUNCTION_PATH);
    if (fnIndex !== -1) {
      targetPath = targetPath.substring(fnIndex + FUNCTION_PATH.length);
    }
    if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;

    // Include query string
    const targetUrl = `${ORIGIN}${targetPath}${url.search}`;
    console.log(`Proxying: ${targetUrl}`);

    // Forward Range header for media streaming
    const headers: Record<string, string> = {};
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) headers["Range"] = rangeHeader;

    let response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      const fallbackUrl = getCdnFallbackUrl(targetPath, url.search);
      if (fallbackUrl) {
        console.warn(`Origin returned ${response.status}, falling back to CDN: ${fallbackUrl}`);
        response.body?.cancel().catch(() => {});
        response = await fetch(fallbackUrl, { headers });
      }
    }

    const contentType = getContentType(targetPath);
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };

    // Forward content-length and range headers
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
    console.error("v3-player-proxy error:", error);
    return new Response(JSON.stringify({ error: "Proxy error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
