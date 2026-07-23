// Generates practice questions for a single section (subtopic) of a topic's
// lecture, using the same section text/bullets that appear in the Notes tab.
// Inserts the generated items into the public.questions table so they show
// up in both the Notes tab and the existing Question Bank.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  topic_id: z.string().uuid(),
  chapter_id: z.string().uuid().nullable().optional(),
  subject_id: z.string().uuid().nullable().optional(),
  section_id: z.string().min(1),
  section_title: z.string().min(1),
  section_text: z.string().optional().default(""),
  key_points: z.array(z.string()).optional().default([]),
  count: z.number().int().min(1).max(10).optional().default(5),
});

interface GeneratedQuestion {
  question_text: string;
  question_type: "mcq" | "short_answer";
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const input = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const prompt = `You are an expert exam-question writer for a school LMS.

Create exactly ${input.count} practice questions strictly grounded in the study material below.
- Mix ~60% multiple-choice (4 options, exactly one correct) and ~40% short-answer.
- Cover different difficulty levels (easy, medium, hard).
- No trick questions; align with what the material actually teaches.
- Keep language crisp; use LaTeX ($...$ or $$...$$) for any math/chemistry equations.

SECTION TITLE: ${input.section_title}

SECTION TEXT:
${(input.section_text || "").slice(0, 6000)}

KEY POINTS:
${(input.key_points || []).map((p, i) => `${i + 1}. ${p}`).join("\n")}

Respond with ONLY a JSON object matching this schema — no prose, no code fences:
{
  "questions": [
    {
      "question_text": "string",
      "question_type": "mcq" | "short_answer",
      "options": ["A","B","C","D"],           // required only for mcq
      "correct_answer": "string",              // for mcq, use the exact option text
      "explanation": "string",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output only valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const details = await aiRes.text();
      return new Response(
        JSON.stringify({ error: "AI gateway failed", status: aiRes.status, details }),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || "{}";
    let parsedContent: { questions?: GeneratedQuestion[] } = {};
    try {
      parsedContent = JSON.parse(content);
    } catch {
      const match = String(content).match(/\{[\s\S]*\}/);
      if (match) parsedContent = JSON.parse(match[0]);
    }

    const questions = (parsedContent.questions || []).filter(
      (q) => q && q.question_text && q.correct_answer
    );

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, message: "No questions generated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Best-effort subtopic mapping by title similarity
    let subtopicId: string | null = null;
    const { data: subs } = await admin
      .from("subtopics")
      .select("id, title")
      .eq("topic_id", input.topic_id);
    if (subs && subs.length) {
      const st = input.section_title.toLowerCase();
      const match = subs.find(
        (s: any) =>
          s.title &&
          (s.title.toLowerCase().includes(st) || st.includes(s.title.toLowerCase()))
      );
      subtopicId = match?.id || null;
    }

    const rows = questions.map((q) => ({
      topic_id: input.topic_id,
      chapter_id: input.chapter_id ?? null,
      subtopic_id: subtopicId,
      question_text: q.question_text,
      question_type: q.question_type === "mcq" ? "mcq" : "short_answer",
      question_format: q.question_type === "mcq" ? "objective" : "subjective",
      options:
        q.question_type === "mcq" && Array.isArray(q.options)
          ? q.options.reduce(
              (acc: Record<string, string>, opt, i) => ({
                ...acc,
                [String.fromCharCode(65 + i)]: String(opt),
              }),
              {}
            )
          : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation ?? null,
      difficulty: q.difficulty ?? "medium",
      marks: 1,
      is_ai_generated: true,
      is_verified: false,
      source_document_purpose: "ai_notes",
      answer_source: "ai_notes",
    }));

    const { data: inserted, error: insErr } = await admin
      .from("questions")
      .insert(rows)
      .select("id");

    if (insErr) {
      return new Response(
        JSON.stringify({ error: "DB insert failed", details: insErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ inserted: inserted?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-topic-notes-questions] error", err);
    return new Response(
      JSON.stringify({ error: String((err as Error)?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
