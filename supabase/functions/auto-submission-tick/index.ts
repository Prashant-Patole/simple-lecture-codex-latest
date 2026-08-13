// Auto Submission Tick - server-driven pipeline runner.
// Invoked by pg_cron every minute. For each running auto_submission_runs row,
// advances the current item one step (submit -> processing -> sanity -> next).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_JOBS_PER_IP = 2;
const PENDING_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const PROCESSING_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const SUBMITTING_LOCK_MS = 5 * 60 * 1000;

type ItemStatus =
  | "queued"
  | "submitting"
  | "waiting"
  | "processing"
  | "completed"
  | "sanity_checking"
  | "passed"
  | "stopped";

interface Item {
  documentId: string;
  displayName: string;
  sourceUrl?: string | null;
  fileName?: string | null;
  sourceType?: string | null;
  markdown?: string | null;
  status: ItemStatus;
  externalJobId?: string;
  dbJobId?: string;
  progress?: number;
  currentStep?: string;
  currentPhase?: string;
  stopReason?: string;
  sanityDetail?: string;
  submittedAt?: string;
  submittingAt?: string;
}

interface SanitySummary {
  avatar_healthy: number; avatar_total: number;
  topic_healthy: number; topic_total: number;
  images_healthy: number; images_total: number;
}

function evaluateJobStatus(status: string | null | undefined) {
  if (status === "completed") return { proceed: true as const };
  return { proceed: false as const, reason: `Job ended as ${status ?? "unknown"}` };
}

function evaluateSanity(s: SanitySummary | null | undefined) {
  if (!s) return { passed: false, reason: "No sanity summary returned" };
  if (s.avatar_healthy !== s.avatar_total) return { passed: false, reason: `Avatar ${s.avatar_healthy}/${s.avatar_total}` };
  if (s.topic_healthy !== s.topic_total) return { passed: false, reason: `Topic ${s.topic_healthy}/${s.topic_total}` };
  if (s.images_healthy !== s.images_total) return { passed: false, reason: `Images ${s.images_healthy}/${s.images_total}` };
  const denom = s.avatar_total + s.topic_total + s.images_total;
  const overall = denom > 0 ? Math.round(((s.avatar_healthy + s.topic_healthy + s.images_healthy) / denom) * 100) : 0;
  if (overall !== 100) return { passed: false, reason: `Overall ${overall}%` };
  return { passed: true };
}

async function countSlots(supabase: any, serverIp: string): Promise<number> {
  const now = Date.now();
  const pendingCutoff = new Date(now - PENDING_MAX_AGE_MS).toISOString();
  const processingCutoff = new Date(now - PROCESSING_MAX_AGE_MS).toISOString();
  const { count: p1 } = await supabase
    .from("video_generation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("server_ip", serverIp).eq("status", "pending").gt("created_at", pendingCutoff);
  const { count: p2 } = await supabase
    .from("video_generation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("server_ip", serverIp).eq("status", "processing").gt("created_at", processingCutoff);
  return (p1 || 0) + (p2 || 0);
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
async function genJobPrefix(supabase: any, subjectName: string): Promise<string> {
  const sanitized = subjectName.replace(/\s+/g, "");
  const d = new Date();
  const ts =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0") +
    String(d.getSeconds()).padStart(2, "0") +
    String(d.getMilliseconds()).padStart(3, "0");
  let code = "";
  for (let i = 0; i < 6; i++) code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  const full = `${sanitized}_${ts}_${code}`;
  await supabase.from("video_job_prefixes").insert([{ random_code: code, full_prefix: full, subject_name: sanitized }]);
  return full;
}

const genDbId = () => Math.floor(100000000 + Math.random() * 900000000).toString();

async function callProxy(supabase: any, body: Record<string, unknown>, fnName = "video-generation-proxy") {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => null);
  return { ok: resp.ok, data };
}

async function saveRun(supabase: any, runId: string, patch: Record<string, unknown>) {
  await supabase
    .from("auto_submission_runs")
    .update({ ...patch, last_tick_at: new Date().toISOString() })
    .eq("id", runId);
}

async function processRun(supabase: any, run: any) {
  // Atomically claim this run for the current tick to avoid concurrent
  // manual/cron invocations submitting the same item twice.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_auto_submission_run", {
    _run_id: run.id,
    _cooldown_seconds: 25,
  });
  if (claimError || claimed !== true) {
    if (claimError) console.error("[auto-submission-tick] claim failed", run.id, claimError);
    console.log("[auto-submission-tick] skip", run.id, "another tick is active");
    return;
  }

  const items: Item[] = Array.isArray(run.items) ? run.items : [];
  const idx: number = run.current_index ?? 0;
  if (idx >= items.length) {
    await saveRun(supabase, run.id, { status: "completed" });
    return;
  }
  const item = items[idx];
  const setItem = (patch: Partial<Item>) => {
    items[idx] = { ...items[idx], ...patch };
  };

  const cfg = (run.pipeline_config && typeof run.pipeline_config === "object") ? run.pipeline_config : {};
  const isMarketing = run.kind === "marketing";
  const targetPort: number = Number(cfg.target_port) || (isMarketing ? 5006 : 5005);

  // QUEUED: try to submit if a slot is free
  if (item.status === "queued" || item.status === "waiting" || item.status === "submitting") {
    if (item.status === "submitting" && item.submittingAt) {
      const submittingAge = Date.now() - new Date(item.submittingAt).getTime();
      if (Number.isFinite(submittingAge) && submittingAge < SUBMITTING_LOCK_MS) {
        await saveRun(supabase, run.id, { items });
        return;
      }
    }

    const active = await countSlots(supabase, run.server_ip);
    if (active >= MAX_JOBS_PER_IP) {
      setItem({ status: "waiting" });
      await saveRun(supabase, run.id, { items });
      return;
    }
    setItem({ status: "submitting", submittingAt: new Date().toISOString() });
    await saveRun(supabase, run.id, { items });
    try {
      const jobPrefix = await genJobPrefix(supabase, run.subject_name);
      const payload: Record<string, unknown> = {
        action: "submit",
        server_ip: run.server_ip,
        target_port: targetPort,
        subject: run.subject_name,
        grade: cfg.grade ?? (isMarketing ? "9" : "12"),
        job_prefix: jobPrefix,
        dry_run: false,
        skip_wan: false,
        skip_avatar: false,
        audio_only: false,
        tts_provider: cfg.tts_provider ?? "our_tts",
        pipeline_version: cfg.pipeline_version ?? "v15_v2_director",
        generation_scope: "full",
        video_provider: cfg.video_provider ?? "kie",
        ocr_provider: cfg.ocr_provider ?? "local",
        skip_threejs: false,
        avatar_language: cfg.avatar_language ?? "english",
        llm_routing: cfg.llm_routing ?? {
          chunker: "openrouter", director: "openrouter", manim_renderer: "openrouter",
          remotion_renderer: "openrouter", video_renderer: "openrouter", prompt_enhancer: "openrouter",
        },
      };
      if (cfg.no_quiz !== undefined) payload.no_quiz = cfg.no_quiz;
      if (cfg.image_provider) payload.image_provider = cfg.image_provider;
      if (cfg.image_model) payload.image_model = cfg.image_model;
      if (cfg.avatar_speaker) payload.avatar_speaker = cfg.avatar_speaker;
      if (cfg.tts_engine && cfg.tts_engine !== "default") payload.tts_engine = cfg.tts_engine;

      let effectiveAvatarId = cfg.avatar_id as string | undefined;
      if (!effectiveAvatarId && run.subject_id) {
        const { data: subRow } = await supabase
          .from("popular_subjects")
          .select("avatar_id")
          .eq("id", run.subject_id)
          .maybeSingle();
        if (subRow?.avatar_id) effectiveAvatarId = subRow.avatar_id;
      }
      if (!effectiveAvatarId) {
        effectiveAvatarId = "avatar_5ab07dea"; // Global fallback default avatar ID
      }
      payload.avatar_id = effectiveAvatarId;
      console.log(`[auto-submission-tick] Structured Audit: subject="${run.subject_name}", cfg_avatar_id="${cfg.avatar_id}", effective_avatar_id="${payload.avatar_id}"`);
      if (cfg.model) payload.model = cfg.model;
      if (cfg.title) payload.title = cfg.title;
      // Explicit null when admin selected "None of these" for targeted languages.
      if (Object.prototype.hasOwnProperty.call(cfg, "target_languages")) {
        const langs = cfg.target_languages;
        payload.target_languages = Array.isArray(langs) && langs.length > 0 ? langs : null;
      }
      if (cfg.reel_with_avatar !== undefined) payload.reel_with_avatar = cfg.reel_with_avatar;
      if (cfg.reel_variant) payload.reel_variant = cfg.reel_variant;
      if (cfg.story_hint) payload.story_hint = cfg.story_hint;
      if (cfg.audio_only !== undefined) payload.audio_only = cfg.audio_only;
      if (item.sourceUrl) {
        payload.document_url = item.sourceUrl;
        payload.file_name = item.fileName;
        payload.source_type = item.sourceType;
      } else if (item.markdown) {
        payload.markdown = item.markdown;
      } else {
        throw new Error("No source_url or markdown");
      }
      const { ok, data } = await callProxy(supabase, payload, isMarketing ? "marketing-video-proxy" : "video-generation-proxy");
      if (!ok || !data?.job_id) throw new Error(data?.message || "submit failed");
      const extJobId = data.job_id as string;
      const dbJobId = genDbId();
      await supabase.from("video_generation_jobs").insert([{
        id: dbJobId,
        external_job_id: extJobId,
        document_id: item.documentId,
        subject_id: run.subject_id,
        document_name: item.displayName,
        status: "processing",
        created_by: run.created_by,
        server_ip: run.server_ip,
        target_port: targetPort,
      }]);
      setItem({
        status: "processing",
        externalJobId: extJobId,
        dbJobId,
        progress: 0,
        submittedAt: new Date().toISOString(),
      });
      await saveRun(supabase, run.id, { items });
    } catch (e) {
      setItem({ status: "stopped", stopReason: `Submit failed: ${String((e as Error).message || e)}` });
      await saveRun(supabase, run.id, { items, status: "stopped" });
    }
    return;
  }

  // PROCESSING: poll status
  if (item.status === "processing" && item.externalJobId) {
    const { ok, data } = await callProxy(supabase, {
      action: "status", job_id: item.externalJobId, server_ip: run.server_ip, target_port: targetPort,
    }, isMarketing ? "marketing-video-proxy" : "video-generation-proxy");
    if (!ok || !data) {
      await saveRun(supabase, run.id, { items });
      return;
    }
    setItem({
      progress: typeof data.progress === "number" ? data.progress : item.progress,
      currentStep: data.current_step ?? item.currentStep,
      currentPhase: data.current_phase ?? item.currentPhase,
    });
    const st = data.status as string;
    if (st === "completed" || st === "completed_with_errors" || st === "failed") {
      if (item.dbJobId) {
        await supabase.from("video_generation_jobs").update({
          status: st,
          progress: st === "completed" ? 100 : (data.progress ?? 0),
          video_url: `http://${run.server_ip}:${targetPort}/player_v2/?job=${item.externalJobId}`,
          error_message: data.error ?? null,
        }).eq("id", item.dbJobId);
      }
      const ev = evaluateJobStatus(st);
      if (!ev.proceed) {
        setItem({ status: "stopped", stopReason: ev.reason });
        await saveRun(supabase, run.id, { items, status: "stopped" });
        return;
      }
      // Marketing pipeline skips sanity check
      if (isMarketing) {
        setItem({ status: "passed", progress: 100, sanityDetail: "Completed" });
        const nextIdx = idx + 1;
        const isLast = nextIdx >= items.length;
        await saveRun(supabase, run.id, {
          items,
          current_index: nextIdx,
          status: isLast ? "completed" : "running",
        });
        return;
      }
      setItem({ status: "sanity_checking", progress: 100 });
      await saveRun(supabase, run.id, { items });
      return;
    }
    await saveRun(supabase, run.id, { items });
    return;
  }

  // SANITY
  if (item.status === "sanity_checking" && item.externalJobId) {
    const { ok, data } = await callProxy(supabase, {
      action: "sanity_check", job_id: item.externalJobId, server_ip: run.server_ip,
    });
    if (!ok) {
      // leave for retry next tick
      await saveRun(supabase, run.id, { items });
      return;
    }
    const result = evaluateSanity(data?.summary);
    if (!result.passed) {
      setItem({ status: "stopped", stopReason: `Sanity failed: ${result.reason}`, sanityDetail: result.reason });
      await saveRun(supabase, run.id, { items, status: "stopped" });
      return;
    }
    setItem({ status: "passed", sanityDetail: "All checks 100%" });
    const nextIdx = idx + 1;
    const isLast = nextIdx >= items.length;
    await saveRun(supabase, run.id, {
      items,
      current_index: nextIdx,
      status: isLast ? "completed" : "running",
    });
    return;
  }

  // Anything else (completed/passed/stopped at current_index) - advance
  if (item.status === "passed" || item.status === "completed") {
    const nextIdx = idx + 1;
    const isLast = nextIdx >= items.length;
    await saveRun(supabase, run.id, {
      current_index: nextIdx,
      status: isLast ? "completed" : "running",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: runs } = await supabase
      .from("auto_submission_runs")
      .select("*")
      .eq("status", "running");
    const list = runs || [];
    await Promise.all(list.map((r: any) => processRun(supabase, r).catch((e) => {
      console.error("[auto-submission-tick] run", r.id, e);
    })));
    return new Response(JSON.stringify({ processed: list.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[auto-submission-tick] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
