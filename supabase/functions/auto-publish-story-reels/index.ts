// Auto-publishes completed STORY jobs into published_reels so they appear in
// the student Reels feed alongside regular reels.
// Story jobs produce a single final_video and have NO /reels manifest — we
// detect them via /status's final_video_ready flag.
//
// IMPORTANT: this function does NOT touch the reels GET endpoint or
// usePublishedReels hook — it only inserts rows into published_reels.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_IP = "69.197.145.4";
const DEFAULT_PORT = 5006;

// Public proxy that fronts 69.197.145.4:5006 over HTTPS (works in browser).
const VIDEO_PROXY_BASE =
  "https://supabase-proxy.utuberpraveen.workers.dev/functions/v1/v3-player-proxy";

function storyVideoUrl(jobId: string) {
  return `${VIDEO_PROXY_BASE}/player/jobs/${jobId}/videos/presentation_final.mp4`;
}

function deriveStoryTitle(fileName?: string | null) {
  if (!fileName) return "Story";
  const cleaned = fileName.replace(/^Story:\s*/i, "").replace(/[#*_`>]/g, "").trim();
  const firstLine = cleaned.split(/\r?\n/)[0].trim();
  const short = firstLine.length > 80 ? firstLine.slice(0, 77) + "..." : firstLine;
  return short || "Story";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const summary = {
    jobs_scanned: 0,
    stories_detected: 0,
    published: 0,
    skipped: 0,
    errors: 0,
    details: [] as any[],
  };

  try {
    // Look at recently completed reel_jobs (last 30 days for stories backlog).
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: jobs, error } = await supabase
      .from("reel_jobs")
      .select("id, job_id, server_ip, target_port, subject_id, document_id, file_name, completed_at, status")
      .eq("status", "completed")
      .gte("completed_at", since)
      .not("job_id", "is", null);

    if (error) throw error;
    summary.jobs_scanned = jobs?.length ?? 0;

    for (const job of jobs ?? []) {
      try {
        const ip = job.server_ip || DEFAULT_IP;
        const port = Number(job.target_port) || DEFAULT_PORT;

        // Heuristic 1: file_name prefix marks it as a story
        const isStoryByName = /^story\s*:/i.test(job.file_name || "");

        // Heuristic 2: confirm via /status (final_video_ready + no /reels)
        const statusUrl = `http://${ip}:${port}/job/${job.job_id}/status`;
        const sResp = await fetch(statusUrl);
        if (!sResp.ok) {
          summary.errors++;
          summary.details.push({ job: job.job_id, err: `status ${sResp.status}` });
          continue;
        }
        const sJson = await sResp.json();
        const finalReady = sJson?.final_video_ready === true;

        if (!isStoryByName && !finalReady) {
          // Regular reels job — leave to other publishers.
          summary.skipped++;
          continue;
        }
        if (!finalReady) {
          summary.skipped++;
          continue;
        }
        summary.stories_detected++;

        // Resolve topic/chapter if document linked (often null for stories)
        let topic_id: string | null = null;
        let chapter_id: string | null = null;
        if (job.document_id) {
          const { data: doc } = await supabase
            .from("ai_assistant_documents")
            .select("topic_id, chapter_id")
            .eq("id", job.document_id)
            .maybeSingle();
          topic_id = doc?.topic_id ?? null;
          chapter_id = doc?.chapter_id ?? null;
        }

        const devVideoUrl = storyVideoUrl(job.job_id!);
        const { error: upErr } = await supabase
          .from("published_reels")
          .upsert(
            {
              reel_job_id: job.id,
              external_job_id: job.job_id,
              document_id: job.document_id,
              subject_id: job.subject_id,
              chapter_id,
              topic_id,
              reel_index: 0,
              variant: "story",
              variant_dir: "final",
              title: deriveStoryTitle(job.file_name),
              video_url: devVideoUrl,
              is_published: true,
              published_by: null,
            },
            { onConflict: "external_job_id,reel_index,variant", ignoreDuplicates: false }
          );
        if (upErr) {
          console.error("upsert error", upErr);
          summary.errors++;
          summary.details.push({ job: job.job_id, err: upErr.message });
        } else {
          summary.published++;
          summary.details.push({ job: job.job_id, published: true });
        }

        // Persist dev-server URL row
        await supabase.from("reel_devserver_urls").upsert(
          {
            reel_job_id: job.id,
            external_job_id: job.job_id,
            reel_index: 0,
            variant: "story",
            variant_dir: "final",
            video_url: devVideoUrl,
            server_ip: ip,
            target_port: port,
          },
          { onConflict: "external_job_id,reel_index,variant" }
        );

        // Persist Vimeo URL if the status payload exposed one
        const vimeoUrl: string | null =
          sJson?.vimeo_url ||
          sJson?.final_video_vimeo_url ||
          (Array.isArray(sJson?.reels_vimeo) && sJson.reels_vimeo[0]?.vimeo_url) ||
          null;
        if (vimeoUrl) {
          const m = String(vimeoUrl).match(/vimeo\.com\/(\d+)/);
          await supabase.from("reel_vimeo_urls").upsert(
            {
              reel_job_id: job.id,
              external_job_id: job.job_id,
              reel_index: 0,
              variant: "story",
              vimeo_url: vimeoUrl,
              vimeo_id: m?.[1] ?? null,
            },
            { onConflict: "external_job_id,reel_index,variant" }
          );
        }
      } catch (e) {
        console.error("job loop error", job.job_id, e);
        summary.errors++;
        summary.details.push({ job: job.job_id, err: String((e as any)?.message || e) });
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("auto-publish-story-reels error", err);
    return new Response(
      JSON.stringify({ error: String((err as any)?.message || err), summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
