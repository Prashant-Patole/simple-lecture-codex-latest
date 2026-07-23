// Auto-sync ready presentations from external AI Teaching API into
// pregen_question_cache. Designed to be invoked by pg_cron every 5 minutes.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_API_BASE = "http://116.202.230.124:8000";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiRes = await fetch(`${AI_API_BASE}/questions?status=ready`);
    if (!apiRes.ok) throw new Error(`AI API returned ${apiRes.status}`);

    const data = await apiRes.json();
    const readyJobs: any[] = Array.isArray(data)
      ? data
      : data?.questions ?? data?.items ?? data?.data ?? [];

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const job of readyJobs) {
      const qId = job.question_id || job.id;
      if (!qId) {
        skipped++;
        continue;
      }

      try {
        const existing = await supabase
          .from("pregen_question_cache")
          .select("question_id")
          .eq("question_id", qId)
          .maybeSingle();

        if (existing.data) {
          skipped++;
          continue;
        }

        const presRes = await fetch(`${AI_API_BASE}/ai-teaching-assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "full",
            question: job.question_text,
            subjectId: job.subject_id,
            subjectName: job.subject_name || job.subject_title || "Unknown",
            topicId: job.topic_id,
            chapterId: job.chapter_id,
            language: "en-IN",
          }),
        });

        if (!presRes.ok) {
          failed++;
          continue;
        }

        const presentation = await presRes.json();

        const { error } = await supabase
          .from("pregen_question_cache")
          .upsert(
            {
              question_id: qId,
              subject_id: job.subject_id ?? null,
              question_text: job.question_text ?? null,
              response_json: presentation,
            },
            { onConflict: "question_id" },
          );

        if (error) {
          console.error(`Upsert failed for ${qId}:`, error.message);
          failed++;
        } else {
          synced++;
        }
      } catch (e) {
        console.error(`Failed to sync question ${qId}:`, (e as Error).message);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ synced, failed, skipped, total: readyJobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
