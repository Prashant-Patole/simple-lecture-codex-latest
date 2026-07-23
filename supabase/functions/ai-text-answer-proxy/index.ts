// Proxies the doubts tab to the external AI text-answer service.
// Hides the API key and bridges HTTPS -> HTTP mixed-content.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UPSTREAM = "http://116.202.230.124:8000/ai-text-answer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const subjectId = typeof body?.subjectId === "string" ? body.subjectId : "";
    const subjectName =
      typeof body?.subjectName === "string" ? body.subjectName : undefined;
    const language = typeof body?.language === "string" ? body.language : "en";

    if (!question || !subjectId) {
      return new Response(
        JSON.stringify({ error: "question and subjectId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("AI_TEXT_ANSWER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI_TEXT_ANSWER_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let upstream: Response;
    try {
      upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ question, subjectId, subjectName, language }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      console.error("[ai-text-answer-proxy] upstream fetch failed", err?.message);
      return new Response(
        JSON.stringify({
          error: err?.name === "AbortError" ? "Upstream timeout" : "Upstream unreachable",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    clearTimeout(timeout);

    const text = await upstream.text();
    // Preserve upstream status (200 vs 404 no_content) verbatim.
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err: any) {
    console.error("[ai-text-answer-proxy] unexpected", err?.message);
    return new Response(
      JSON.stringify({ error: err?.message || "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
