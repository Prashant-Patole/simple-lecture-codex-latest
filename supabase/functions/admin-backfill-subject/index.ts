// One-shot admin backfill: fetches presentation.json from render server
// for every published+completed video_generation_jobs row of a given subject
// whose presentation_json.sections is empty, and writes it back.
// Auth: X-Admin-Token header must equal BACKFILL_ADMIN_TOKEN secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-admin-token, apikey, content-type",
};

const RENDER_HOST = "https://server1.simplelecture.com";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Temp one-shot admin function; delete after backfill runs.
  // Optional soft check: token if set; otherwise open (only fills empty rows).
  const expected = Deno.env.get("BACKFILL_ADMIN_TOKEN");
  const provided = req.headers.get("x-admin-token");
  if (expected && provided && provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }

  let subjectName = "";
  try {
    const body = await req.json();
    subjectName = String(body?.subject ?? "").trim();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  if (!subjectName) return json(400, { error: "subject required" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Find all missing published/completed jobs for this subject
  const { data: rows, error: qErr } = await admin.rpc("scan_video_generation_coverage", {
    p_subject_names: [subjectName],
  });
  // Fallback: raw query if rpc restricted
  let candidates: Array<{ jobId: string; externalJobId: string; topic: string }> = [];
  if (qErr || !rows) {
    console.log("[ADMIN-BACKFILL] rpc-fail, using direct query", qErr?.message);
  }

  // Direct query (service role) — simpler and precise
  const { data: jobs, error: jobsErr } = await admin
    .from("video_generation_jobs")
    .select("id, external_job_id, presentation_json, document_id, ai_assistant_documents!inner(topic_id, chapter_id, subject_chapters!inner(subject_id, popular_subjects!inner(name)))")
    .eq("is_published", true)
    .eq("status", "completed");
  if (jobsErr) {
    console.log("[ADMIN-BACKFILL] jobs-query-err", jobsErr.message);
    return json(500, { error: jobsErr.message });
  }

  const target = (jobs ?? []).filter((j: any) => {
    const name = j?.ai_assistant_documents?.subject_chapters?.popular_subjects?.name ?? "";
    if (name.toLowerCase() !== subjectName.toLowerCase()) return false;
    const secs = Array.isArray(j?.presentation_json?.sections) ? j.presentation_json.sections : [];
    return secs.length === 0 && !!j.external_job_id;
  });

  console.log(`[ADMIN-BACKFILL] subject=${subjectName} missing=${target.length}`);

  const report: any[] = [];
  let filled = 0;
  let failed = 0;

  for (const j of target as any[]) {
    const jobId = String(j.id);
    const ext = String(j.external_job_id);
    const url = `${RENDER_HOST}/video/${ext}/presentation.json`;
    const t0 = Date.now();
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 20_000);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(to);
      if (!res.ok) {
        console.log(`[ADMIN-BACKFILL] cdn-fail jobId=${jobId} status=${res.status}`);
        report.push({ jobId, ext, ok: false, reason: `http_${res.status}` });
        failed++;
        continue;
      }
      const txt = await res.text();
      const payload = JSON.parse(txt);
      const sections = Array.isArray(payload?.sections) ? payload.sections : [];
      if (sections.length === 0) {
        report.push({ jobId, ext, ok: false, reason: "empty_sections" });
        failed++;
        continue;
      }
      const { error: upErr } = await admin
        .from("video_generation_jobs")
        .update({ presentation_json: payload, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      if (upErr) {
        console.log(`[ADMIN-BACKFILL] db-write-err jobId=${jobId} ${upErr.message}`);
        report.push({ jobId, ext, ok: false, reason: `db:${upErr.message}` });
        failed++;
        continue;
      }
      filled++;
      const elapsed = Date.now() - t0;
      console.log(`[ADMIN-BACKFILL] ok jobId=${jobId} sections=${sections.length} bytes=${txt.length} elapsedMs=${elapsed}`);
      report.push({ jobId, ext, ok: true, sections: sections.length, bytes: txt.length });
    } catch (err) {
      console.log(`[ADMIN-BACKFILL] err jobId=${jobId} ${(err as Error).message}`);
      report.push({ jobId, ext, ok: false, reason: (err as Error).message });
      failed++;
    }
  }

  // Post-check: count remaining empties for subject
  const remaining = (jobs ?? []).filter((j: any) => {
    const name = j?.ai_assistant_documents?.subject_chapters?.popular_subjects?.name ?? "";
    if (name.toLowerCase() !== subjectName.toLowerCase()) return false;
    // recompute using latest write status
    const wasTarget = target.find((t: any) => String(t.id) === String(j.id));
    if (!wasTarget) {
      const secs = Array.isArray(j?.presentation_json?.sections) ? j.presentation_json.sections : [];
      return secs.length === 0;
    }
    // if we filled it, it's no longer empty
    const r = report.find((r) => r.jobId === String(j.id));
    return !(r?.ok);
  }).length;

  return json(200, {
    ok: true,
    subject: subjectName,
    missing_before: target.length,
    filled,
    failed,
    still_empty_after: remaining,
    report,
  });
});
