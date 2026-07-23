import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let videoId = url.searchParams.get("id");
    if (!videoId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const v = body.vimeo_url || body.url || body.id;
      if (v) {
        const m = String(v).match(/(\d+)/);
        videoId = m ? m[1] : null;
      }
    }
    if (!videoId) {
      return new Response(JSON.stringify({ error: "missing id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("VIMEO_ACCESS_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "VIMEO_ACCESS_TOKEN not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "vimeo api failed", status: res.status, body: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();

    // Prefer play.progressive[] (available on Pro+ plans)
    const progressive: Array<{ link: string; width: number; height: number; rendition?: string }> =
      data?.play?.progressive || data?.files || [];

    if (url.searchParams.get("debug") === "1") {
      return new Response(
        JSON.stringify({
          has_play: !!data?.play,
          play_keys: data?.play ? Object.keys(data.play) : [],
          play_progressive_len: data?.play?.progressive?.length ?? null,
          files_len: data?.files?.length ?? null,
          download_len: data?.download?.length ?? null,
          privacy: data?.privacy,
          user_account: data?.user?.account,
          top_keys: Object.keys(data),
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!progressive.length) {
      return new Response(
        JSON.stringify({
          error: "no progressive mp4 available (requires Vimeo Pro/Business+ plan with Video Files scope)",
          hint: "Ensure token has 'video_files' scope and account plan supports progressive downloads",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sort by height desc, pick highest
    const sorted = [...progressive].sort((a, b) => (b.height || 0) - (a.height || 0));
    const best = sorted[0];

    return new Response(
      JSON.stringify({
        video_id: videoId,
        mp4_url: best.link,
        width: best.width,
        height: best.height,
        rendition: best.rendition,
        qualities: sorted.map((f) => ({ link: f.link, height: f.height, width: f.width, rendition: f.rendition })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
