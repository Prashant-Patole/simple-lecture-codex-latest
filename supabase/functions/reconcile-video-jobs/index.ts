// Reconciles video_generation_jobs against the upstream pipeline /status endpoint.
// Runs every 5 minutes via pg_cron. Marks completed/failed/stale jobs so rows
// never stay stuck in 'processing' when the admin UI tab is closed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_MISSES = 3;
const STALE_HOURS = 6;
const DEFAULT_IP = "69.197.145.4";
const DEFAULT_PORT = 5005;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const summary = { checked: 0, updated: 0, completed: 0, failed: 0, errors: 0 };

  try {
    const { data: jobs, error } = await supabase
      .from("video_generation_jobs")
      .select(
        "id, external_job_id, server_ip, target_port, status, progress, current_step, current_phase, updated_at, reconcile_miss_count"
      )
      .in("status", ["pending", "processing"]);

    if (error) throw error;

    summary.checked = jobs?.length ?? 0;

    for (const job of jobs ?? []) {
      if (!job.external_job_id) continue;

      // Stale-guard: no progress for >STALE_HOURS hours
      const ageMs = Date.now() - new Date(job.updated_at).getTime();
      if (ageMs > STALE_HOURS * 3600 * 1000 && (job.progress ?? 0) === 0) {
        await supabase
          .from("video_generation_jobs")
          .update({
            status: "failed",
            error_message: `Timed out — no progress for ${STALE_HOURS}h`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        summary.failed++;
        summary.updated++;
        continue;
      }

      // Ask upstream via existing proxy (handles routing, port, etc.)
      // Route marketing-port jobs through the dedicated marketing proxy.
      const jobPort = Number(job.target_port) || DEFAULT_PORT;
      const proxyName = jobPort === 5006 ? "marketing-video-proxy" : "video-generation-proxy";
      let statusData: any = null;
      let upstreamError: any = null;
      try {
        const resp = await supabase.functions.invoke(proxyName, {
          body: {
            action: "status",
            job_id: job.external_job_id,
            server_ip: job.server_ip || DEFAULT_IP,
            target_port: jobPort,
          },
        });
        statusData = resp.data;
        upstreamError = resp.error;
      } catch (e) {
        upstreamError = e;
      }

      const notFound =
        upstreamError ||
        !statusData ||
        statusData?.error ||
        statusData?.status === "not_found";

      if (notFound) {
        const newMiss = (job.reconcile_miss_count ?? 0) + 1;
        if (newMiss >= MAX_MISSES) {
          await supabase
            .from("video_generation_jobs")
            .update({
              status: "failed",
              error_message: "Upstream lost job (reconciler)",
              completed_at: new Date().toISOString(),
              reconcile_miss_count: newMiss,
            })
            .eq("id", job.id);
          summary.failed++;
          summary.updated++;
        } else {
          await supabase
            .from("video_generation_jobs")
            .update({ reconcile_miss_count: newMiss })
            .eq("id", job.id);
          summary.errors++;
        }
        continue;
      }

      const upstreamStatus = String(statusData.status || "").toLowerCase();
      const progress = typeof statusData.progress === "number" ? statusData.progress : job.progress;

      if (upstreamStatus === "completed" || upstreamStatus === "completed_with_errors") {
        await supabase
          .from("video_generation_jobs")
          .update({
            status: upstreamStatus,
            progress: upstreamStatus === "completed" ? 100 : progress,
            completed_at: new Date().toISOString(),
            reconcile_miss_count: 0,
          })
          .eq("id", job.id);
        summary.completed++;
        summary.updated++;
      } else if (upstreamStatus === "failed" || upstreamStatus === "error") {
        await supabase
          .from("video_generation_jobs")
          .update({
            status: "failed",
            error_message: statusData.error || statusData.error_message || "Pipeline reported failure",
            completed_at: new Date().toISOString(),
            reconcile_miss_count: 0,
          })
          .eq("id", job.id);
        summary.failed++;
        summary.updated++;
      } else {
        // still processing — refresh fields, reset miss counter
        await supabase
          .from("video_generation_jobs")
          .update({
            status: "processing",
            progress: progress ?? 0,
            current_step: statusData.current_step ?? job.current_step,
            current_phase: statusData.current_phase ?? job.current_phase,
            reconcile_miss_count: 0,
          })
          .eq("id", job.id);
        summary.updated++;
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("reconcile-video-jobs error", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err), summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
