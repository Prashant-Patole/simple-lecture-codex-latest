// Enumerates all completed video_generation_jobs with an external_job_id
// and inserts a new cdn_presentation_refresh_runs row queueing them for
// CDN-based presentation.json refresh.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

const j = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j(405, { error: "method" });

  let onlyEmpty = false;
  let publishedOnly = false;
  let label = "CDN refresh — all completed jobs";
  let externalJobId: string | null = null;
  try {
    const b = await req.json().catch(() => ({}));
    onlyEmpty = !!b?.only_empty;
    publishedOnly = !!b?.published_only;
    if (b?.label) label = String(b.label);
    if (b?.external_job_id) externalJobId = String(b.external_job_id).trim();
  } catch { /* ignore */ }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Verify caller is admin (JWT from Authorization header)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return j(401, { error: "missing auth" });
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: userRes } = await userClient.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) return j(401, { error: "unauthorized" });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return j(403, { error: "not admin" });

  // Single-job mode: queue exactly one external_job_id
  const jobs: Array<{ video_job_id: string; external_job_id: string; status: string; error_message: string | null }> = [];

  if (externalJobId) {
    const { data: row, error: singleErr } = await admin
      .from("video_generation_jobs")
      .select("id, external_job_id, status")
      .eq("external_job_id", externalJobId)
      .maybeSingle();
    if (singleErr) return j(500, { error: singleErr.message });
    if (!row) return j(404, { error: `No video_generation_jobs row with external_job_id=${externalJobId}` });
    jobs.push({
      video_job_id: String((row as any).id),
      external_job_id: String((row as any).external_job_id),
      status: "pending",
      error_message: null,
    });
    label = `CDN refresh — job ${externalJobId}`;
  } else {
    // Paginate through completed jobs (Supabase caps at 1000 per query)
    const PAGE = 1000;
    let from = 0;
    while (true) {
      let q = admin
        .from("video_generation_jobs")
        .select("id, external_job_id, presentation_json, is_published, status")
        .eq("status", "completed")
        .not("external_job_id", "is", null)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      const { data, error } = await q;
      if (error) return j(500, { error: error.message });
      if (!data || data.length === 0) break;
      for (const row of data as any[]) {
        if (publishedOnly && row.is_published !== true) continue;
        if (onlyEmpty) {
          const secs = Array.isArray(row?.presentation_json?.sections) ? row.presentation_json.sections : [];
          if (secs.length > 0) continue;
        }
        jobs.push({
          video_job_id: String(row.id),
          external_job_id: String(row.external_job_id),
          status: "pending",
          error_message: null,
        });
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  if (jobs.length === 0) return j(200, { ok: true, queued: 0, message: "No matching jobs" });

  const { data: inserted, error: insErr } = await admin
    .from("cdn_presentation_refresh_runs")
    .insert({
      status: "processing",
      job_queue: jobs,
      total_jobs: jobs.length,
      label,
      created_by: userId,
    })
    .select("id")
    .single();
  if (insErr) return j(500, { error: insErr.message });

  return j(200, { ok: true, run_id: inserted.id, queued: jobs.length });
});
