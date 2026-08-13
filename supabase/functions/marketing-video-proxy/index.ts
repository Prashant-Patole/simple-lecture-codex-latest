// Marketing Video Proxy — isolated from lecture/reel video-generation-proxy.
// Handles submit + status for the marketing pipeline only.
// Default target: 204.12.237.78:5006, pipeline_version=v3_visual_first.
// Changing this file MUST NOT affect ongoing lecture / reel jobs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_IP = "204.12.237.78";
const DEFAULT_PORT = 5006;

function normalizeTargetLanguages(value: unknown): string | null {
  // Explicit JSON null / empty means "none of these" — do not send a language list.
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const joined = value.map(String).filter(Boolean).join(",");
    return joined || null;
  }
  const asString = String(value).trim();
  if (!asString || asString.toLowerCase() === "null") return null;
  return asString;
}

const getMimeType = (name: string): string => {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  const m: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    md: "text/markdown",
    txt: "text/plain",
    html: "text/html",
  };
  return m[ext] || "application/octet-stream";
};

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { ok: false, status: 401, msg: "Missing token" };
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (token === serviceKey) return { ok: true };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, msg: "Invalid token" };
  return { ok: true };
}

async function downloadDocument(documentUrl: string, fileName: string | undefined): Promise<Blob> {
  if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) {
    const r = await fetch(documentUrl);
    if (!r.ok) throw new Error(`download failed: ${r.status}`);
    const buf = await r.arrayBuffer();
    return new Blob([buf], { type: getMimeType(fileName || documentUrl) });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // First try Supabase Storage for newer/non-B2 files.
  const { data: signed } = await supabase.storage
    .from("uploaded-question-documents")
    .createSignedUrl(documentUrl, 3600);
  if (signed?.signedUrl) {
    const r = await fetch(signed.signedUrl);
    if (!r.ok) throw new Error(`storage download failed: ${r.status}`);
    const buf = await r.arrayBuffer();
    return new Blob([buf], { type: getMimeType(fileName || documentUrl) });
  }

  // Fallback for AI documents that live only in private Backblaze B2.
  let { data: b2Record } = await supabase
    .from("storage_files")
    .select("file_path")
    .eq("file_path", documentUrl)
    .maybeSingle();

  if (!b2Record && fileName) {
    const { data } = await supabase
      .from("storage_files")
      .select("file_path")
      .eq("file_name", fileName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    b2Record = data;
  }

  const b2Path = b2Record?.file_path || documentUrl;
  return await downloadFromB2(b2Path, fileName || documentUrl);
}

function normalizeB2Path(filePath: string): string {
  return filePath
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}

async function downloadFromB2(filePath: string, fallbackName: string): Promise<Blob> {
  const keyId = Deno.env.get("B2_KEY_ID");
  const appKey = Deno.env.get("B2_APPLICATION_KEY");
  const bucketId = Deno.env.get("B2_BUCKET_ID");
  const bucketName = Deno.env.get("B2_BUCKET_NAME");
  if (!keyId || !appKey || !bucketId || !bucketName) {
    throw new Error("B2 credentials not configured for marketing document download");
  }

  const authResp = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: "Basic " + btoa(`${keyId}:${appKey}`) },
  });
  if (!authResp.ok) throw new Error(`B2 authorization failed: ${authResp.status}`);
  const auth = await authResp.json();

  const encodedPath = normalizeB2Path(filePath);
  const dlAuthResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix: encodedPath,
      validDurationInSeconds: 3600,
    }),
  });
  if (!dlAuthResp.ok) throw new Error(`B2 download authorization failed: ${dlAuthResp.status}`);
  const dlAuth = await dlAuthResp.json();

  const b2Url = `${auth.downloadUrl}/file/${bucketName}/${encodedPath}?Authorization=${dlAuth.authorizationToken}`;
  const resp = await fetch(b2Url);
  if (!resp.ok) throw new Error(`B2 document download failed: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return new Blob([buf], { type: getMimeType(fallbackName) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.msg }), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      action, job_id, server_ip, target_port,
      document_url, file_name, markdown,
      subject, grade, job_prefix, title,
      tts_provider, pipeline_version, video_provider, image_provider, image_model,
      no_quiz, avatar_speaker, avatar_language, avatar_id, ocr_provider, skip_threejs,
      skip_wan, skip_avatar, dry_run, generation_scope, llm_routing,
      audio_only, model, target_languages, reel_with_avatar, reel_variant, story_hint,
      tts_engine,
    } = body;

    const ip = server_ip || DEFAULT_IP;
    const port = target_port || DEFAULT_PORT;
    const base = `http://${ip}:${port}`;

    if (action === "submit") {
      console.log(`[marketing:submit] target=${base}, doc=${file_name || "markdown"}`);
      let fileBlob: Blob;
      let uploadName: string;
      if (document_url) {
        fileBlob = await downloadDocument(document_url, file_name);
        uploadName = file_name || "document";
      } else if (markdown) {
        fileBlob = new Blob([markdown], { type: "text/markdown" });
        uploadName = "document.md";
      } else {
        return new Response(JSON.stringify({ error: "document_url or markdown required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fd = new FormData();
      fd.append("file", fileBlob, uploadName);
      fd.append("subject", subject || "General Science");
      fd.append("grade", String(grade || "9"));
      fd.append("tts_provider", tts_provider || "edge_tts");
      fd.append("pipeline_version", pipeline_version || "v3_visual_first");
      fd.append("video_provider", video_provider || "kie");
      fd.append("image_provider", image_provider || "gpu");
      fd.append("image_model", image_model || "flux_dev");
      fd.append("skip_wan", String(skip_wan ?? false));
      fd.append("skip_avatar", String(skip_avatar ?? false));
      fd.append("audio_only", String(audio_only ?? false));
      fd.append("dry_run", String(dry_run ?? false));
      fd.append("generation_scope", generation_scope || "full");
      fd.append("no_quiz", String(no_quiz ?? true));
      if (model) fd.append("model", String(model));
      if (title) fd.append("title", String(title));
      const normalizedTargetLanguages = normalizeTargetLanguages(target_languages);
      if (normalizedTargetLanguages) {
        fd.append("target_languages", normalizedTargetLanguages);
      } else {
        // "None of these" — omit field so submit_job receives null/None
        console.log("[marketing:submit] target_languages=null (none of these)");
      }
      if (reel_with_avatar !== undefined) fd.append("reel_with_avatar", String(reel_with_avatar));
      if (reel_variant) fd.append("reel_variant", String(reel_variant));
      if (story_hint) fd.append("story_hint", String(story_hint));
      if (avatar_language) fd.append("avatar_language", String(avatar_language));
      const effectiveTtsEngine = tts_engine && String(tts_engine).toLowerCase() !== "default"
        ? String(tts_engine).toLowerCase()
        : "";
      if (effectiveTtsEngine) fd.append("tts_engine", effectiveTtsEngine);
      // IndicF5 clones avatar reference audio — omit speaker (matches HeyGem routing).
      if (effectiveTtsEngine === "indicf5") {
        console.log("[marketing:submit] avatar_speaker suppressed for indicf5");
      } else if (avatar_speaker) {
        fd.append("avatar_speaker", String(avatar_speaker));
      }
      let resolvedAvatarId = avatar_id ? String(avatar_id) : "";
      if (!resolvedAvatarId && subject) {
        try {
          const admin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } }
          );
          const { data: subRow } = await admin
            .from("popular_subjects")
            .select("avatar_id")
            .ilike("name", String(subject).trim())
            .maybeSingle();
          if (subRow?.avatar_id) resolvedAvatarId = String(subRow.avatar_id);
        } catch (e) {
          console.warn("[marketing-video-proxy] Unable to resolve subject avatar_id:", e);
        }
      }
      if (!resolvedAvatarId) {
        resolvedAvatarId = "avatar_5ab07dea"; // Global fallback default avatar ID
      }
      fd.append("avatar_id", resolvedAvatarId);
      console.log(`[marketing:submit] Structured Audit: subject="${subject}", raw_avatar_id="${avatar_id}", resolved_avatar_id="${resolvedAvatarId}"`);
      if (ocr_provider) fd.append("ocr_provider", String(ocr_provider));
      if (skip_threejs !== undefined) fd.append("skip_threejs", String(skip_threejs));
      if (llm_routing !== undefined) {
        fd.append("llm_routing", typeof llm_routing === "string" ? llm_routing : JSON.stringify(llm_routing));
      }
      if (job_prefix) fd.append("job_prefix", job_prefix);

      try {
        const resp = await fetch(`${base}/submit_job`, { method: "POST", body: fd });
        const data = await resp.json().catch(() => ({}));
        console.log(`[marketing:submit] status=${resp.status}`);
        return new Response(JSON.stringify(data), {
          status: resp.ok ? 200 : resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("[marketing:submit] error", e);
        return new Response(JSON.stringify({
          status: "error",
          error: `Marketing server unreachable at ${base}. ${e instanceof Error ? e.message : String(e)}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "status") {
      if (!job_id) {
        return new Response(JSON.stringify({ error: "job_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const resp = await fetch(`${base}/job/${job_id}/status`);
        const data = await resp.json().catch(() => ({}));
        return new Response(JSON.stringify({
          ...data,
          player_url: `${base}/player_v2/?job=${job_id}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({
          status: "error",
          error: `Marketing status unreachable: ${e instanceof Error ? e.message : String(e)}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[marketing-video-proxy] fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
