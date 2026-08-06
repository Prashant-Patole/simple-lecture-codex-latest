import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-notes-pipeline-internal",
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanJson = (value: string) =>
  value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

const parseRelevantIds = (value: string) => {
  try {
    const parsed = JSON.parse(cleanJson(value));
    return Array.isArray(parsed?.relevant_ids) ? parsed.relevant_ids.map(String) : [];
  } catch {
    // A truncated JSON response can still contain complete UUIDs. Candidate filtering below
    // ensures that no ID outside the supplied batch can ever be allocated.
    return value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || [];
  }
};

const chunksOf = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const stopWords = new Set([
  "about", "after", "another", "before", "being", "between", "could", "does",
  "following", "former", "from", "have", "into", "most", "other", "their",
  "there", "these", "they", "this", "those", "using", "what", "when", "where",
  "which", "while", "with", "would",
]);

const meaningfulWords = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g)
    ?.filter((word) => !stopWords.has(word)) || [];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pipelineSecret = Deno.env.get("NOTES_PIPELINE_INTERNAL_SECRET") || "";
    const authorization = req.headers.get("Authorization") || "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const bearerToken = authorization.replace(/^Bearer\s+/i, "");
    const internalToken = req.headers.get("x-notes-pipeline-internal") || "";
    const isInternalRequest =
      bearerToken === serviceRoleKey ||
      (pipelineSecret.length >= 32 && internalToken === pipelineSecret);

    if (!isInternalRequest) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      });
      const { data: authData } = await userClient.auth.getUser();
      if (!authData.user) return jsonResponse(401, { error: "Unauthorized" });

      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) return jsonResponse(403, { error: "Admin access required" });
    }

    const body = await req.json();
    const subjectId = String(body?.subject_id || "");
    const chapterId = String(body?.chapter_id || "");
    const topicId = String(body?.topic_id || "");
    if (!subjectId || !chapterId || !topicId) {
      return jsonResponse(400, { error: "subject_id, chapter_id and topic_id are required" });
    }

    const [{ data: chapter }, { data: topic }] = await Promise.all([
      admin
        .from("subject_chapters")
        .select("id, title, subject_id")
        .eq("id", chapterId)
        .eq("subject_id", subjectId)
        .maybeSingle(),
      admin
        .from("subject_topics")
        .select("id, title, chapter_id")
        .eq("id", topicId)
        .eq("chapter_id", chapterId)
        .maybeSingle(),
    ]);
    if (!chapter || !topic) return jsonResponse(404, { error: "Invalid subject context" });

    const { data: pyqRows, error: pyqError } = await admin
      .from("pyq_questions")
      .select("id, question_text, question_format, options, chapter_id, topic_id")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (pyqError) throw pyqError;

    const alreadyAllocated = (pyqRows || []).filter((row) => row.topic_id === topicId);
    const candidates = (pyqRows || []).filter(
      (row) => !row.topic_id && (!row.chapter_id || row.chapter_id === chapterId),
    );

    if (candidates.length === 0) {
      return jsonResponse(200, {
        important_questions: alreadyAllocated.map((row) => ({
          question_type: row.question_format === "mcq" ? "mcq" : "normal",
          question_text: row.question_text,
        })),
        allocated_count: alreadyAllocated.length,
        newly_allocated_count: 0,
        candidates_checked: 0,
      });
    }

    const { data: configRow } = await admin
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", "ai_api_config")
      .maybeSingle();
    const config = configRow?.setting_value as Record<string, unknown> | null;
    if (
      !config?.enabled ||
      config.provider !== "openrouter" ||
      typeof config.openrouter_api_key !== "string" ||
      !config.openrouter_api_key
    ) {
      return jsonResponse(200, {
        important_questions: alreadyAllocated.map((row) => ({
          question_type: row.question_format === "mcq" ? "mcq" : "normal",
          question_text: row.question_text,
        })),
        allocated_count: alreadyAllocated.length,
        newly_allocated_count: 0,
        candidates_checked: candidates.length,
        warnings: ["The admin OpenRouter configuration is unavailable; existing allocations were used."],
      });
    }

    const topicContext = {
      chapter: String(body?.chapter_title || chapter.title || "").slice(0, 500),
      topic: String(body?.topic_title || topic.title || "").slice(0, 500),
      parsed_content: String(body?.content_markdown || "").slice(0, 12000),
      normal_questions: Array.isArray(body?.questions)
        ? body.questions.slice(0, 100).map((question: unknown) =>
            typeof question === "string"
              ? question.slice(0, 500)
              : String((question as Record<string, unknown>)?.question_text || "").slice(0, 500)
          )
        : [],
    };

    const contextWords = new Set(
      meaningfulWords(
        [
          topicContext.topic,
          topicContext.parsed_content,
          ...topicContext.normal_questions,
        ].join(" "),
      ),
    );
    const contextCandidates = candidates.filter((row) => {
      const optionText = row.options ? JSON.stringify(row.options) : "";
      const matches = new Set(
        meaningfulWords(`${row.question_text} ${optionText}`)
          .filter((word) => contextWords.has(word)),
      );
      return matches.size >= 2;
    });

    if (contextCandidates.length === 0) {
      return jsonResponse(200, {
        important_questions: alreadyAllocated.map((row) => ({
          question_type: row.question_format === "mcq" ? "mcq" : "normal",
          question_text: row.question_text,
        })),
        allocated_count: alreadyAllocated.length,
        newly_allocated_count: 0,
        candidates_checked: candidates.length,
      });
    }

    const model =
      typeof config.default_model === "string" && config.default_model
        ? config.default_model
        : "google/gemini-2.5-flash";

    const classifyBatch = async (batch: typeof candidates) => {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openrouter_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You allocate previous-year exam questions to one exact textbook topic. " +
                "Select a question only when its answer is explicitly and directly supported by the " +
                "supplied parsed content or normal questions. Do not select questions about a related " +
                "cause, consequence, person, date, or event that is only mentioned in passing. Do not " +
                "select broad chapter-level themes, definitions, or outcomes unless this exact topic teaches " +
                "them. Do not select merely because it belongs to the same subject or chapter. When uncertain, omit it. " +
                'Return strict JSON only: {"relevant_ids":["uuid"]}.',
            },
            {
              role: "user",
              content: JSON.stringify({
                topic_context: topicContext,
                candidate_questions: batch.map((row) => ({
                  id: row.id,
                  question_text: row.question_text,
                  question_format: row.question_format,
                  options: row.options,
                })),
              }),
            },
          ],
        }),
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`OpenRouter classification failed (${response.status}): ${details.slice(0, 300)}`);
      }
      const result = await response.json();
      const raw = String(result.choices?.[0]?.message?.content || "");
      return parseRelevantIds(raw);
    };

    const batches = chunksOf(contextCandidates, 60);
    const classificationResults = await Promise.allSettled(batches.map(classifyBatch));
    const classifiedIds = classificationResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
    const warnings = classificationResults.flatMap((result, index) =>
      result.status === "rejected"
        ? [`PYQ classification batch ${index + 1} was skipped: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
        : []
    );
    const candidateIds = new Set(contextCandidates.map((row) => row.id));
    const relevantIds = [...new Set(classifiedIds)].filter((id) => candidateIds.has(id));

    for (const idBatch of chunksOf(relevantIds, 100)) {
      const { error } = await admin
        .from("pyq_questions")
        .update({ chapter_id: chapterId, topic_id: topicId })
        .in("id", idBatch)
        .is("topic_id", null);
      if (error) throw error;
    }

    const relevantSet = new Set(relevantIds);
    const newlyAllocated = candidates.filter((row) => relevantSet.has(row.id));
    const allRelevant = [...alreadyAllocated, ...newlyAllocated];

    return jsonResponse(200, {
      important_questions: allRelevant.map((row) => ({
        question_type: row.question_format === "mcq" ? "mcq" : "normal",
        question_text: row.question_text,
      })),
      allocated_count: allRelevant.length,
      newly_allocated_count: newlyAllocated.length,
      candidates_checked: candidates.length,
      model,
      warnings,
    });
  } catch (error) {
    console.error("[allocate-topic-pyqs]", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unable to allocate PYQ questions",
    });
  }
});
