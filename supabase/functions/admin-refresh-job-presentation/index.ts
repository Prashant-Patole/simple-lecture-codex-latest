// One-shot: refresh presentation_json for a single video_generation_jobs row
// by fetching the CDN copy from the render server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const RENDER_HOST = "https://server1.simplelecture.com";
const j = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j(405, { error: "method" });

  let job_id: string | number | null = null;
  let external_job_id: string | null = null;
  try {
    const b = await req.json();
    job_id = b?.job_id ?? null;
    external_job_id = b?.external_job_id ?? null;
  } catch { return j(400, { error: "bad json" }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let row: any = null;
  if (job_id != null) {
    const r = await admin.from("video_generation_jobs").select("id, external_job_id").eq("id", job_id).maybeSingle();
    row = r.data;
  } else if (external_job_id) {
    const r = await admin.from("video_generation_jobs").select("id, external_job_id").eq("external_job_id", external_job_id).maybeSingle();
    row = r.data;
  }
  if (!row) return j(404, { error: "job not found" });

  const url = `${RENDER_HOST}/video/${row.external_job_id}/presentation.json`;
  const res = await fetch(url);
  if (!res.ok) return j(502, { error: `cdn_${res.status}`, url });
  const payload = await res.json();
  const secs = Array.isArray(payload?.sections) ? payload.sections : [];
  if (secs.length === 0) return j(422, { error: "empty_sections", url });

  const { error: upErr } = await admin
    .from("video_generation_jobs")
    .update({ presentation_json: payload, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (upErr) return j(500, { error: upErr.message });

  return j(200, {
    ok: true,
    job_id: row.id,
    external_job_id: row.external_job_id,
    sections: secs.length,
    section_ids: secs.map((s: any) => s?.section_id),
  });
});
