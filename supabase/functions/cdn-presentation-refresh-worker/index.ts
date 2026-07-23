// Processes cdn_presentation_refresh_runs by fetching presentation.json
// from the render CDN (server1.simplelecture.com) and writing it into
// video_generation_jobs.presentation_json.
// Invoked by pg_cron every minute; also callable manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

const RENDER_HOST = "https://server1.simplelecture.com";
const SOFT_LOCK_SECONDS = 45;
const MAX_PER_INVOCATION = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: runs, error } = await admin
    .from("cdn_presentation_refresh_runs")
    .select("*")
    .eq("status", "processing")
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!runs?.length) {
    return new Response(JSON.stringify({ ok: true, message: "no active runs" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  for (const run of runs) {
    const updatedAt = new Date(run.updated_at).getTime();
    if (Date.now() - updatedAt < SOFT_LOCK_SECONDS * 1000) {
      console.log(`[CDN_PRES] run ${run.id} soft-locked, skipping`);
      continue;
    }
    // Claim
    await admin
      .from("cdn_presentation_refresh_runs")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", run.id);

    await processRun(admin, run);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

async function processRun(admin: any, run: any) {
  const jobs: Array<any> = Array.isArray(run.job_queue) ? run.job_queue : [];
  if (jobs.length === 0) {
    await admin.from("cdn_presentation_refresh_runs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }

  // Fresh status check (cancellation)
  const { data: fresh } = await admin
    .from("cdn_presentation_refresh_runs")
    .select("status")
    .eq("id", run.id)
    .maybeSingle();
  if (fresh?.status === "cancelled") {
    console.log(`[CDN_PRES] run ${run.id} cancelled`);
    return;
  }

  let idx = run.current_job_index ?? 0;
  let completed = run.completed_jobs ?? 0;
  let failed = run.failed_jobs ?? 0;
  let skipped = run.skipped_jobs ?? 0;
  let processed = 0;

  while (idx < jobs.length && processed < MAX_PER_INVOCATION) {
    const job = jobs[idx];
    const jobNum = idx + 1;
    const total = jobs.length;
    const url = `${RENDER_HOST}/video/${job.external_job_id}/presentation.json`;

    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 20_000);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(to);

      if (!res.ok) {
        console.warn(`[CDN_PRES] ${jobNum}/${total} ${job.external_job_id} — http_${res.status}`);
        if (res.status === 404) {
          job.status = "skipped";
          job.error_message = `http_404 (missing on CDN)`;
          skipped++;
        } else {
          job.status = "failed";
          job.error_message = `http_${res.status}`;
          failed++;
        }
      } else {
        const txt = await res.text();
        let payload: any = null;
        try { payload = JSON.parse(txt); } catch { /* ignore */ }
        const secs = Array.isArray(payload?.sections) ? payload.sections : [];
        if (!payload || secs.length === 0) {
          job.status = "skipped";
          job.error_message = "empty_sections";
          skipped++;
        } else {
          const { error: upErr } = await admin
            .from("video_generation_jobs")
            .update({ presentation_json: payload, updated_at: new Date().toISOString() })
            .eq("id", job.video_job_id);
          if (upErr) {
            console.error(`[CDN_PRES] ${jobNum}/${total} db-fail ${upErr.message}`);
            job.status = "failed";
            job.error_message = `db:${upErr.message}`.slice(0, 400);
            failed++;
          } else {
            job.status = "completed";
            completed++;
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[CDN_PRES] ${jobNum}/${total} err ${msg}`);
      job.status = "failed";
      job.error_message = msg.slice(0, 400);
      failed++;
    }

    idx++;
    processed++;
  }

  const newStatus = idx >= jobs.length ? "completed" : "processing";
  await admin
    .from("cdn_presentation_refresh_runs")
    .update({
      status: newStatus,
      job_queue: jobs,
      current_job_index: idx,
      completed_jobs: completed,
      failed_jobs: failed,
      skipped_jobs: skipped,
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  console.log(`[CDN_PRES] run ${run.id}: ${completed} ok, ${failed} failed, ${skipped} skipped, ${idx}/${jobs.length}`);
}
