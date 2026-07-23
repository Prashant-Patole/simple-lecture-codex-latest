import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function invokeFn(name: string, body: any, authHeader: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: { raw: text } }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userRes.user.id;

    const { self_test_id } = await req.json();
    if (!self_test_id) {
      return new Response(JSON.stringify({ error: "self_test_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: test, error: testErr } = await admin.from("self_tests").select("*").eq("id", self_test_id).maybeSingle();
    if (testErr || !test) {
      return new Response(JSON.stringify({ error: "Test not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Authorize: owner or admin
    if (test.student_id !== userId) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: questions = [] } = await admin.from("self_test_questions").select("*").eq("self_test_id", self_test_id);
    const { data: answers = [] } = await admin.from("self_test_answers").select("*").eq("self_test_id", self_test_id);

    const ansBy: Record<string, any> = {};
    for (const a of answers) ansBy[a.self_test_question_id] = a;

    let mcqScore = 0;
    let writtenScore = 0;
    let totalMax = 0;

    const mcqUpdates: any[] = [];
    const writtenTasks: { q: any; a: any }[] = [];

    for (const q of questions) {
      const a = ansBy[q.id];
      const maxM = Number(q.marks ?? 1);
      totalMax += maxM;
      if (!a) continue;

      if (q.section === "mcq") {
        const sel = (a.selected_option || a.answer_text || "").trim().toLowerCase();
        const correct = (q.correct_answer || "").trim().toLowerCase();
        const isCorrect = sel.length > 0 && sel === correct;
        const awarded = isCorrect ? maxM : 0;
        mcqScore += awarded;
        mcqUpdates.push({
          id: a.id,
          is_correct: isCorrect,
          marks_awarded: awarded,
          max_marks: maxM,
        });
      } else {
        writtenTasks.push({ q, a });
      }
    }

    // Apply MCQ updates
    for (const u of mcqUpdates) {
      await admin.from("self_test_answers").update({
        is_correct: u.is_correct,
        marks_awarded: u.marks_awarded,
        max_marks: u.max_marks,
      }).eq("id", u.id);
    }

    // Process written in batches of 3
    const BATCH = 3;
    for (let i = 0; i < writtenTasks.length; i += BATCH) {
      const slice = writtenTasks.slice(i, i + BATCH);
      const results = await Promise.all(slice.map(async ({ q, a }) => {
        const maxM = Number(q.marks ?? 1);
        let extracted = a.extracted_text || null;
        let studentAnswer = a.answer_text || "";

        if (!studentAnswer.trim() && a.answer_image_url) {
          if (!extracted) {
            const ocr = await invokeFn("extract-answer-from-image", {
              image_url: a.answer_image_url,
              question_context: q.question_text,
            }, authHeader);
            if (ocr.ok && ocr.data?.extracted_text && ocr.data.extracted_text !== "UNREADABLE") {
              extracted = ocr.data.extracted_text;
            }
          }
          studentAnswer = extracted || `[Image answer uploaded - could not extract]`;
        }

        let isCorrect = false;
        let awarded = 0;
        let feedback: string | null = null;

        if (!q.correct_answer || !q.correct_answer.trim()) {
          feedback = "No reference answer available for grading.";
        } else if (!studentAnswer.trim()) {
          feedback = "No answer provided.";
        } else {
          const grade = await invokeFn("ai-check-answer", {
            question_id: q.id,
            question_text: q.question_text,
            question_type: "subjective",
            correct_answer: q.correct_answer,
            student_answer: studentAnswer,
            max_marks: maxM,
          }, authHeader);
          if (grade.ok) {
            isCorrect = !!grade.data.is_correct;
            awarded = Number(grade.data.marks_awarded) || 0;
            feedback = grade.data.feedback || null;
          } else {
            feedback = `AI grading failed (status ${grade.status}).`;
          }
        }

        await admin.from("self_test_answers").update({
          is_correct: isCorrect,
          marks_awarded: awarded,
          max_marks: maxM,
          ai_feedback: feedback,
          extracted_text: extracted,
        }).eq("id", a.id);

        return awarded;
      }));
      writtenScore += results.reduce((s, x) => s + x, 0);
    }

    const totalScore = mcqScore + writtenScore;
    const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 1000) / 10 : 0;

    await admin.from("self_tests").update({
      mcq_score: mcqScore,
      written_score: writtenScore,
      total_score: totalScore,
      total_max_marks: totalMax,
      percentage,
    }).eq("id", self_test_id);

    return new Response(JSON.stringify({
      success: true,
      mcq_score: mcqScore,
      written_score: writtenScore,
      total_score: totalScore,
      total_max_marks: totalMax,
      percentage,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[regrade-self-test]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
