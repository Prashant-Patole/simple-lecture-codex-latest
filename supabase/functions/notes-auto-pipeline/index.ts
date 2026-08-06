import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

const DEFAULT_API_BASE = "http://116.202.230.124:8000";
const REQUEST_TIMEOUT_MS = 420_000;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeBody = (text: string) => {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const requestJson = async (url: string, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { status: response.status, body: normalizeBody(text) };
  } finally {
    clearTimeout(timeout);
  }
};

const freshReadUrl = (url: string) =>
  `${url}${url.includes("?") ? "&" : "?"}_notes_ts=${Date.now()}`;

const findDocumentId = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["document_id", "doc_id", "id"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  for (const key of ["document", "result", "data"]) {
    const nested = findDocumentId(record[key]);
    if (nested) return nested;
  }
  return null;
};

const getQueueResponse = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value || {};
  const record = value as Record<string, unknown>;
  if ("queue_response" in record) return record.queue_response || {};
  if ("latest_status" in record || "final_status" in record || "queued" in record) return {};
  return value;
};

const readGenerationState = (body: Record<string, unknown>) => {
  const documentStatus = String(body.document_status || body.status || "").toLowerCase();
  const topicsDone = Number(body.topics_done || 0);
  const topicsPending = Number(body.topics_pending || 0);
  const topicsFailed = Number(body.topics_failed || 0);
  const failed = topicsFailed > 0 || /(fail|error|cancel|stopp)/.test(documentStatus);
  const countersComplete = topicsDone > 0 && topicsPending === 0 && topicsFailed === 0;
  const completed =
    !failed &&
    (countersComplete ||
      /(done|complete|notes_ready|generated)/.test(documentStatus) ||
      (documentStatus === "ready" && topicsDone > 0 && topicsPending === 0));
  return { documentStatus, topicsDone, topicsPending, topicsFailed, failed, completed };
};

const fetchGeneratedResult = async (apiBase: string, documentId: string) => {
  const documentResult = await requestJson(
    freshReadUrl(`${apiBase}/notes/document/${encodeURIComponent(documentId)}`),
    { headers: { "Cache-Control": "no-cache" } },
  );
  if (documentResult.status !== 200) {
    throw new Error(`Generated Notes retrieval returned HTTP ${documentResult.status}.`);
  }

  const documentBody = documentResult.body as Record<string, unknown>;
  const topics = Array.isArray(documentBody.topics) ? documentBody.topics : [];
  const topicResponses: Array<Record<string, unknown>> = [];
  for (const topic of topics) {
    const topicId = String((topic as Record<string, unknown>)?.topic_note_id || "");
    if (!topicId) continue;
    const topicResult = await requestJson(
      freshReadUrl(`${apiBase}/notes/topic/${encodeURIComponent(topicId)}`),
      { headers: { "Cache-Control": "no-cache" } },
    );
    if (topicResult.status !== 200) {
      throw new Error(`Generated topic retrieval returned HTTP ${topicResult.status}.`);
    }
    topicResponses.push({
      topic_note_id: topicId,
      http_status: topicResult.status,
      response: topicResult.body,
    });
  }

  return {
    document_http_status: documentResult.status,
    document: documentBody,
    topics: topicResponses,
  };
};

const toApiFormat = (format?: string | null) => {
  if (["single_choice", "multiple_choice", "mcq"].includes(format || "")) return "mcq";
  if (format === "true_false") return "true_false";
  if (format === "short_answer") return "short_answer";
  return "long_answer";
};

const toApiDifficulty = (difficulty?: string | null) => {
  const value = difficulty?.toLowerCase();
  if (value === "easy" || value === "low") return "Easy";
  if (value === "hard" || value === "advanced") return "Hard";
  return "Medium";
};

const extractContentMarkdown = (doc: Record<string, unknown> | null, topic: Record<string, unknown>) => {
  const content = doc?.full_content;
  const parsed = content && typeof content === "object" && !Array.isArray(content)
    ? content as Record<string, unknown>
    : null;
  return String(
    parsed?.content_markdown ||
      parsed?.markdown ||
      parsed?.content ||
      parsed?.text ||
      (typeof content === "string" ? content : "") ||
      topic.content_markdown ||
      topic.notes_markdown ||
      "",
  );
};

const invokeAllocator = async (
  supabaseUrl: string,
  anonKey: string,
  pipelineSecret: string,
  body: Record<string, unknown>,
) => {
  const response = await requestJson(`${supabaseUrl}/functions/v1/allocate-topic-pyqs`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "x-notes-pipeline-internal": pipelineSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    const detail = (response.body as Record<string, unknown>)?.error || JSON.stringify(response.body);
    throw new Error(`PYQ allocation failed (${response.status}): ${detail}`);
  }
  return response.body as Record<string, unknown>;
};

const failRun = async (
  admin: ReturnType<typeof createClient>,
  item: Record<string, unknown>,
  message: string,
  patch: Record<string, unknown> = {},
) => {
  await admin
    .from("notes_auto_pipeline_items")
    .update({
      ...patch,
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await admin
    .from("notes_auto_pipeline_items")
    .update({
      status: "stopped",
      error_message: "Pipeline stopped after a previous topic failed.",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("run_id", item.run_id)
    .eq("status", "queued");

  await admin
    .from("notes_auto_pipeline_runs")
    .update({
      status: "failed",
      failed_items: 1,
      error_message: message,
      current_topic_id: item.topic_id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.run_id);
};

const scheduleNextTick = (supabaseUrl: string, anonKey: string, delayMs = 15_000) => {
  EdgeRuntime.waitUntil(
    (async () => {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      await fetch(`${supabaseUrl}/functions/v1/notes-auto-pipeline`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "tick" }),
      });
    })().catch((error) => console.error("[notes-auto-pipeline] next tick failed", error)),
  );
};

const finishItem = async (
  admin: ReturnType<typeof createClient>,
  item: Record<string, unknown>,
  supabaseUrl: string,
  anonKey: string,
  statusResponse: unknown,
  finalResponse: unknown,
) => {
  const now = new Date().toISOString();
  await admin
    .from("notes_auto_pipeline_items")
    .update({
      status: "submitted",
      generation_response: {
        queue_response: getQueueResponse(item.generation_response),
        final_status: statusResponse,
      },
      final_response_http_status: 200,
      final_response: finalResponse,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", item.id);

  const { count: remaining } = await admin
    .from("notes_auto_pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", item.run_id)
    .eq("status", "queued");
  const { count: completed } = await admin
    .from("notes_auto_pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", item.run_id)
    .eq("status", "submitted");

  await admin
    .from("notes_auto_pipeline_runs")
    .update({
      status: remaining === 0 ? "completed" : "running",
      completed_items: completed || 0,
      current_topic_id: null,
      completed_at: remaining === 0 ? now : null,
      updated_at: now,
    })
    .eq("id", item.run_id);

  if ((remaining || 0) > 0) scheduleNextTick(supabaseUrl, anonKey, 0);
};

const backfillMissingResult = async (
  admin: ReturnType<typeof createClient>,
) => {
  const { data: item } = await admin
    .from("notes_auto_pipeline_items")
    .select("id, external_document_id, run:notes_auto_pipeline_runs!inner(api_base)")
    .eq("status", "submitted")
    .is("final_response", null)
    .not("external_document_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!item?.external_document_id) return { processed: false };

  const runValue = item.run as unknown;
  const run = (Array.isArray(runValue) ? runValue[0] : runValue) as Record<string, unknown> | null;
  const apiBase = String(run?.api_base || DEFAULT_API_BASE).replace(/\/+$/, "");
  const statusResult = await requestJson(
    freshReadUrl(`${apiBase}/notes/status/${encodeURIComponent(String(item.external_document_id))}`),
    { headers: { "Cache-Control": "no-cache" } },
  );
  if (statusResult.status !== 200) return { processed: false, backfill_status: statusResult.status };
  const state = readGenerationState(statusResult.body as Record<string, unknown>);
  if (!state.completed) return { processed: false, backfill_waiting: true };

  const finalResponse = await fetchGeneratedResult(apiBase, String(item.external_document_id));
  await admin
    .from("notes_auto_pipeline_items")
    .update({
      generation_response: {
        final_status: statusResult.body,
      },
      final_response_http_status: 200,
      final_response: finalResponse,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  return { processed: true, backfilled: true, item_id: item.id };
};

const processNext = async (
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
  pipelineSecret: string,
) => {
  const { data: claimedRows, error: claimError } = await admin.rpc("claim_notes_auto_pipeline_item");
  if (claimError) throw claimError;
  const item = claimedRows?.[0] as Record<string, unknown> | undefined;
  if (!item) return await backfillMissingResult(admin);

  try {
    const { data: run, error: runError } = await admin
      .from("notes_auto_pipeline_runs")
      .select("id, api_base, status, stop_requested")
      .eq("id", item.run_id)
      .single();
    if (runError || !run || run.status !== "running" || run.stop_requested) {
      throw new Error("Pipeline was stopped before this topic could be submitted.");
    }

    const apiBase = String(run.api_base || DEFAULT_API_BASE).replace(/\/+$/, "");
    if (item.external_document_id && item.generation_http_status === 200) {
      const statusResult = await requestJson(
        freshReadUrl(`${apiBase}/notes/status/${encodeURIComponent(String(item.external_document_id))}`),
        { headers: { "Cache-Control": "no-cache" } },
      );
      if (statusResult.status !== 200) {
        await failRun(admin, item, `Notes status returned HTTP ${statusResult.status}.`, {
          generation_response: {
            queue_response: getQueueResponse(item.generation_response),
            final_status: statusResult.body,
          },
        });
        return { processed: true, failed: true };
      }

      const statusBody = statusResult.body as Record<string, unknown>;
      const generationState = readGenerationState(statusBody);
      const { documentStatus, failed, completed } = generationState;

      if (failed) {
        await failRun(admin, item, `Notes generation finished with status '${documentStatus || "failed"}'.`, {
          generation_response: {
            queue_response: getQueueResponse(item.generation_response),
            final_status: statusBody,
          },
        });
        return { processed: true, failed: true };
      }
      const shouldProbeGeneratedResult =
        !failed && generationState.topicsPending === 0 && generationState.topicsFailed === 0;
      if (completed || shouldProbeGeneratedResult) {
        let finalResponse: unknown;
        try {
          finalResponse = await fetchGeneratedResult(
            apiBase,
            String(item.external_document_id),
          );
          const generatedTopics = Array.isArray(
            (finalResponse as Record<string, unknown>)?.topics,
          )
            ? (finalResponse as Record<string, unknown>).topics as unknown[]
            : [];
          if (generatedTopics.length > 0) {
            await finishItem(admin, item, supabaseUrl, anonKey, statusBody, finalResponse);
            return { processed: true, failed: false, completed: true, item_id: item.id };
          }
          if (completed) {
            throw new Error("Notes status completed but no generated topic response was available.");
          }
        } catch (error) {
          if (!completed) {
            console.warn(
              "[notes-auto-pipeline] generated result is not available yet; continuing to wait",
              error,
            );
          } else {
            const message = error instanceof Error ? error.message : String(error);
            await failRun(admin, item, message, {
              generation_response: {
                queue_response: getQueueResponse(item.generation_response),
                final_status: statusBody,
              },
            });
            return { processed: true, failed: true };
          }
        }
      }

      await admin
        .from("notes_auto_pipeline_items")
        .update({
          generation_response: {
            queue_response: getQueueResponse(item.generation_response),
            latest_status: statusBody,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      scheduleNextTick(supabaseUrl, anonKey);
      return {
        processed: true,
        waiting: true,
        item_id: item.id,
        remote_status: documentStatus,
        generation_state: generationState,
      };
    }

    const [
      subjectResult,
      chapterResult,
      topicResult,
      docResult,
      questionsResult,
      allocatedPyqsResult,
    ] = await Promise.all([
      admin.from("popular_subjects").select("id, name, slug").eq("id", item.subject_id).single(),
      admin.from("subject_chapters").select("id, chapter_number, title").eq("id", item.chapter_id).single(),
      admin
        .from("subject_topics")
        .select("id, topic_number, title, content_markdown, notes_markdown")
        .eq("id", item.topic_id)
        .single(),
      admin
        .from("ai_assistant_documents")
        .select("id, display_name, source_type, source_url, status, created_at, full_content")
        .eq("topic_id", item.topic_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("questions")
        .select("id, question_text, question_format, options, correct_answer, difficulty, marks")
        .eq("topic_id", item.topic_id),
      admin
        .from("pyq_questions")
        .select("question_text, question_format")
        .eq("topic_id", item.topic_id),
    ]);

    if (subjectResult.error) throw subjectResult.error;
    if (chapterResult.error) throw chapterResult.error;
    if (topicResult.error) throw topicResult.error;
    if (docResult.error) throw docResult.error;
    if (questionsResult.error) throw questionsResult.error;
    if (allocatedPyqsResult.error) {
      console.warn("[notes-auto-pipeline] unable to load existing PYQ allocations", allocatedPyqsResult.error);
    }

    const subject = subjectResult.data as Record<string, unknown>;
    const chapter = chapterResult.data as Record<string, unknown>;
    const topic = topicResult.data as Record<string, unknown>;
    const doc = docResult.data as Record<string, unknown> | null;
    const questions = questionsResult.data || [];
    const contentMarkdown = extractContentMarkdown(doc, topic);

    const existingImportantQuestions = (allocatedPyqsResult.data || []).map((row) => ({
      question_type: row.question_format === "mcq" ? "mcq" : "normal",
      question_text: row.question_text,
    }));
    let allocation: Record<string, unknown> = {
      important_questions: existingImportantQuestions,
      allocated_count: existingImportantQuestions.length,
      newly_allocated_count: 0,
    };
    try {
      allocation = await invokeAllocator(supabaseUrl, anonKey, pipelineSecret, {
        subject_id: item.subject_id,
        chapter_id: item.chapter_id,
        chapter_title: chapter.title,
        topic_id: item.topic_id,
        topic_title: topic.title,
        content_markdown: contentMarkdown,
        questions: questions.map((question) => ({ question_text: question.question_text })),
      });
    } catch (allocationError) {
      console.warn(
        "[notes-auto-pipeline] PYQ allocation skipped; Notes generation will continue",
        allocationError,
      );
    }

    const parsed = doc?.full_content && typeof doc.full_content === "object" && !Array.isArray(doc.full_content)
      ? doc.full_content as Record<string, unknown>
      : {};
    const payload: Record<string, unknown> = {
      subject: { id: subject.id, name: subject.name || "", slug: subject.slug || "" },
      chapter: {
        id: chapter.id,
        chapter_number: chapter.chapter_number,
        title: chapter.title,
      },
      topic: { id: topic.id, topic_number: topic.topic_number, title: topic.title },
      questions: questions.map((question) => ({
        id: question.id,
        question_text: question.question_text,
        question_format: toApiFormat(question.question_format),
        options: question.options || {},
        correct_answer: question.correct_answer || "",
        difficulty: toApiDifficulty(question.difficulty),
        marks: question.marks || 1,
      })),
      important_questions: Array.isArray(allocation.important_questions)
        ? allocation.important_questions
        : [],
    };
    if (doc || contentMarkdown) {
      payload.document = {
        id: doc?.id,
        display_name: doc?.display_name || `${topic.title}.md`,
        source_type: doc?.source_type || "markdown",
        source_url: doc?.source_url,
        status: doc?.status,
        created_at: doc?.created_at,
        parsed_json: { ...parsed, content_markdown: contentMarkdown },
      };
    }

    const imported = await requestJson(`${apiBase}/documents/import-json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (imported.status !== 200) {
      await failRun(admin, item, `Document import returned HTTP ${imported.status}.`, {
        payload,
        import_http_status: imported.status,
        import_response: imported.body,
      });
      return { processed: true, failed: true };
    }

    const documentId = findDocumentId(imported.body) || String(doc?.id || "") || null;
    if (!documentId) {
      await failRun(admin, item, "Document import returned HTTP 200 but no document ID.", {
        payload,
        import_http_status: imported.status,
        import_response: imported.body,
      });
      return { processed: true, failed: true };
    }

    const generated = await requestJson(
      `${apiBase}/notes/generate/${encodeURIComponent(documentId)}`,
      { method: "POST" },
    );
    if (generated.status !== 200) {
      await failRun(admin, item, `Notes generation returned HTTP ${generated.status}.`, {
        payload,
        import_http_status: imported.status,
        import_response: imported.body,
        external_document_id: documentId,
        generation_http_status: generated.status,
        generation_response: { queue_response: generated.body },
      });
      return { processed: true, failed: true };
    }

    const now = new Date().toISOString();
    await admin
      .from("notes_auto_pipeline_items")
      .update({
        status: "processing",
        payload,
        import_http_status: imported.status,
        import_response: imported.body,
        external_document_id: documentId,
        generation_http_status: generated.status,
        generation_response: { queue_response: generated.body },
        completed_at: null,
        updated_at: now,
      })
      .eq("id", item.id);
    scheduleNextTick(supabaseUrl, anonKey);
    return { processed: true, failed: false, waiting: true, item_id: item.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[notes-auto-pipeline] topic failed", item.id, error);
    await failRun(admin, item, message);
    return { processed: true, failed: true };
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pipelineSecret = Deno.env.get("NOTES_PIPELINE_INTERNAL_SECRET") || "";
    if (pipelineSecret.length < 32) throw new Error("Notes pipeline internal secret is not configured");
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "tick");

    if (action === "tick") {
      return jsonResponse(
        200,
        await processNext(admin, supabaseUrl, anonKey, serviceRoleKey, pipelineSecret),
      );
    }

    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData } = await userClient.auth.getUser();
    if (!authData.user) return jsonResponse(401, { error: "Unauthorized" });
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return jsonResponse(403, { error: "Admin access required" });

    if (action === "stop") {
      const runId = String(body?.run_id || "");
      if (!runId) return jsonResponse(400, { error: "run_id is required" });
      const now = new Date().toISOString();
      await admin
        .from("notes_auto_pipeline_runs")
        .update({ stop_requested: true, status: "stopped", completed_at: now, updated_at: now })
        .eq("id", runId)
        .eq("subject_id", body?.subject_id);
      await admin
        .from("notes_auto_pipeline_items")
        .update({ status: "stopped", completed_at: now, updated_at: now })
        .eq("run_id", runId)
        .eq("status", "queued");
      return jsonResponse(200, { success: true, run_id: runId, status: "stopped" });
    }

    if (action !== "start") return jsonResponse(400, { error: "Unknown action" });

    const subjectId = String(body?.subject_id || "");
    const topicIds = Array.isArray(body?.topic_ids)
      ? [...new Set(body.topic_ids.map(String).filter(Boolean))]
      : [];
    const apiBase = String(body?.api_base || DEFAULT_API_BASE).replace(/\/+$/, "");
    if (!subjectId || topicIds.length === 0) {
      return jsonResponse(400, { error: "subject_id and topic_ids are required" });
    }
    try {
      const parsedBase = new URL(apiBase);
      if (!/^https?:$/.test(parsedBase.protocol)) throw new Error("invalid protocol");
    } catch {
      return jsonResponse(400, { error: "Invalid Notes API base URL" });
    }

    const { data: activeRun } = await admin
      .from("notes_auto_pipeline_runs")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("status", "running")
      .maybeSingle();
    if (activeRun) {
      return jsonResponse(409, { error: "This subject already has a running Notes pipeline", run_id: activeRun.id });
    }

    const { data: subject, error: subjectError } = await admin
      .from("popular_subjects")
      .select("id, name")
      .eq("id", subjectId)
      .single();
    if (subjectError) throw subjectError;

    const { data: topics, error: topicsError } = await admin
      .from("subject_topics")
      .select("id, topic_number, title, chapter_id")
      .in("id", topicIds);
    if (topicsError) throw topicsError;
    if (!topics || topics.length !== topicIds.length) {
      return jsonResponse(400, { error: "One or more selected topics are invalid" });
    }

    const chapterIds = [...new Set(topics.map((topic) => topic.chapter_id))];
    const { data: chapters, error: chaptersError } = await admin
      .from("subject_chapters")
      .select("id, subject_id, chapter_number, title")
      .in("id", chapterIds)
      .eq("subject_id", subjectId);
    if (chaptersError) throw chaptersError;
    if (!chapters || chapters.length !== chapterIds.length) {
      return jsonResponse(400, { error: "Selected topics do not belong to this subject" });
    }
    const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));

    const { data: run, error: runError } = await admin
      .from("notes_auto_pipeline_runs")
      .insert({
        subject_id: subjectId,
        subject_name: subject.name,
        api_base: apiBase,
        status: "running",
        total_items: topicIds.length,
        created_by: authData.user.id,
      })
      .select("*")
      .single();
    if (runError) throw runError;

    const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
    const items = topicIds.map((topicId, index) => {
      const topic = topicMap.get(topicId)!;
      const chapter = chapterMap.get(topic.chapter_id)!;
      return {
        run_id: run.id,
        subject_id: subjectId,
        chapter_id: topic.chapter_id,
        topic_id: topic.id,
        sequence_order: index + 1,
        chapter_number: chapter.chapter_number,
        chapter_title: chapter.title,
        topic_number: topic.topic_number,
        topic_title: topic.title,
        status: "queued",
      };
    });
    const { error: itemsError } = await admin.from("notes_auto_pipeline_items").insert(items);
    if (itemsError) {
      await admin.from("notes_auto_pipeline_runs").delete().eq("id", run.id);
      throw itemsError;
    }

    EdgeRuntime.waitUntil(
      processNext(admin, supabaseUrl, anonKey, serviceRoleKey, pipelineSecret),
    );
    return jsonResponse(200, {
      success: true,
      run_id: run.id,
      status: "running",
      total_items: items.length,
      message: `Notes pipeline started for ${items.length} topics.`,
    });
  } catch (error) {
    console.error("[notes-auto-pipeline]", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Notes pipeline request failed",
    });
  }
});
