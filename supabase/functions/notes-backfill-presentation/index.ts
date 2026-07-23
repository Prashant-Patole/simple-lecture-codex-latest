// Notes CDN fallback + auto-backfill
// - Fetches presentation.json from the render server for a given job
// - Writes it back into video_generation_jobs.presentation_json when the DB row is empty/smaller
// - Returns the fetched JSON so the client can render immediately
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
};

const RENDER_HOST = "https://server1.simplelecture.com";
const FETCH_TIMEOUT_MS = 15_000;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const started = Date.now();

  // --- Auth: any authenticated user is allowed. Read-only fallback + a
  // deterministic backfill of an existing row cannot leak data across users.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[BACKFILL] unauthorized: missing bearer");
    return json(401, { error: "Unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "");

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsErr } = await anon.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    console.log("[BACKFILL] unauthorized: bad token", claimsErr?.message);
    return json(401, { error: "Unauthorized" });
  }
  const userId = claimsData.claims.sub;

  // --- Parse body
  let jobId = "";
  let externalJobId = "";
  try {
    const body = await req.json();
    jobId = String(body?.jobId ?? "").trim();
    externalJobId = String(body?.externalJobId ?? "").trim();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  if (!jobId || !externalJobId) {
    return json(400, { error: "jobId and externalJobId are required" });
  }
  if (!/^[A-Za-z0-9_\-]+$/.test(externalJobId)) {
    return json(400, { error: "externalJobId format invalid" });
  }

  console.log(
    `[BACKFILL] start jobId=${jobId} external=${externalJobId} user=${userId}`,
  );

  // --- Fetch presentation.json from the render server
  const cdnUrl = `${RENDER_HOST}/video/${externalJobId}/presentation.json`;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let payload: any;
  let bytes = 0;
  try {
    const res = await fetch(cdnUrl, { signal: controller.signal });
    clearTimeout(to);
    if (!res.ok) {
      console.log(
        `[BACKFILL] cdn-http-fail jobId=${jobId} external=${externalJobId} status=${res.status}`,
      );
      return json(200, {
        ok: false,
        reason: "cdn_http_fail",
        status: res.status,
        presentation: null,
      });
    }
    const txt = await res.text();
    bytes = txt.length;
    payload = JSON.parse(txt);
  } catch (err) {
    clearTimeout(to);
    console.log(
      `[BACKFILL] cdn-fetch-err jobId=${jobId} external=${externalJobId} err=${(err as Error).message}`,
    );
    return json(200, { ok: false, reason: "cdn_fetch_err", presentation: null });
  }

  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  if (sections.length === 0) {
    console.log(
      `[BACKFILL] skip reason=empty-or-invalid jobId=${jobId} external=${externalJobId} bytes=${bytes}`,
    );
    return json(200, {
      ok: false,
      reason: "empty_or_invalid",
      presentation: null,
    });
  }

  // --- Compare with existing DB row via service role (RLS blocks user UPDATE)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: existing, error: readErr } = await admin
    .from("video_generation_jobs")
    .select("id, presentation_json")
    .eq("id", jobId)
    .maybeSingle();

  if (readErr) {
    console.log(`[BACKFILL] db-read-err jobId=${jobId} err=${readErr.message}`);
    return json(200, {
      ok: true,
      wrote: false,
      sections: sections.length,
      bytes,
      presentation: payload,
    });
  }
  if (!existing) {
    console.log(`[BACKFILL] db-row-missing jobId=${jobId}`);
    return json(200, {
      ok: true,
      wrote: false,
      sections: sections.length,
      bytes,
      presentation: payload,
    });
  }

  const existingSections: any[] = Array.isArray(
    (existing as any).presentation_json?.sections,
  )
    ? (existing as any).presentation_json.sections
    : [];

  let wrote = false;
  if (existingSections.length >= sections.length) {
    console.log(
      `[BACKFILL] skip reason=db-already-populated jobId=${jobId} dbSections=${existingSections.length} cdnSections=${sections.length}`,
    );
  } else {
    const { error: upErr } = await admin
      .from("video_generation_jobs")
      .update({
        presentation_json: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (upErr) {
      console.log(`[BACKFILL] db-write-err jobId=${jobId} err=${upErr.message}`);
    } else {
      wrote = true;
      console.log(
        `[BACKFILL] done jobId=${jobId} sections=${sections.length} bytes=${bytes} elapsedMs=${Date.now() - started}`,
      );
    }
  }

  return json(200, {
    ok: true,
    wrote,
    sections: sections.length,
    bytes,
    presentation: payload,
  });
});
