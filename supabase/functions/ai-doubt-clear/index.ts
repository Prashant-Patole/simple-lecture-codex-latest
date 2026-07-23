import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GREETING_RE = /^\s*(hi+|hello+|hey+|yo|sup|test+|ok(ay)?|thanks?|thank\s*you|good\s*(morning|afternoon|evening|night)|how\s*are\s*you|who\s*are\s*you|what'?s\s*up)[\s!.?]*$/i;

function buildRefusal(topicTitle: string, chapterTitle: string) {
  return `I'd love to help, but this question doesn't seem to be part of the current topic "${topicTitle}"${chapterTitle ? ` in ${chapterTitle}` : ""}. Please ask something related to this topic, or head over to the Forum for general questions. 🙏`;
}

function refusalResponse(answer: string) {
  return new Response(
    JSON.stringify({ answer, out_of_syllabus: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, topic_id, student_id } = await req.json();

    if (!question || !topic_id || !student_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get topic context
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select(`
        *,
        chapter:chapters(
          title,
          description,
          course:courses(name)
        )
      `)
      .eq("id", topic_id)
      .single();

    if (topicError || !topic) {
      throw new Error("Topic not found");
    }

    const topicTitle = topic.title || "this topic";
    const chapterTitle = topic.chapter?.title || "";

    // Pre-flight: short/greeting/smalltalk → refuse without hitting model
    const trimmed = String(question).trim();
    if (trimmed.length < 5 || GREETING_RE.test(trimmed)) {
      return refusalResponse(buildRefusal(topicTitle, chapterTitle));
    }

    // Prepare context for RAG
    const context = `
Topic: ${topic.title}
Chapter: ${topic.chapter?.title || ""}
Course: ${topic.chapter?.course?.name || ""}
Content: ${topic.content_markdown || "No detailed content available"}
Description: ${topic.chapter?.description || ""}
`;

    // Get AI configuration from database
    const { data: aiConfig } = await supabase
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_config')
      .maybeSingle();

    const config = aiConfig?.setting_value as any;

    // Determine API endpoint and key based on settings
    let apiUrl: string, apiKey: string, model: string;
    if (config?.enabled && config?.provider === 'openrouter' && config?.openrouter_api_key) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = config.openrouter_api_key;
      model = config.default_model || "google/gemini-2.5-flash";
    } else if (config?.enabled && config?.provider === 'google' && config?.google_api_key) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = config.google_api_key;
      model = config.default_model || "gemini-2.5-flash";
    } else if (config?.enabled && config?.provider === 'openai' && config?.openai_api_key) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = config.openai_api_key;
      model = config.default_model || "gpt-4o-mini";
    } else {
      console.error('No valid AI API configuration found');
      return new Response(
        JSON.stringify({ error: "AI API not configured. Please go to Admin → Settings → AI Functions API Key Settings to add your API key." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ STEP A: Relevance classifier ============
    console.log("Classifying doubt relevance:", question);
    const classifyRes = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are a strict relevance classifier for a school LMS. Decide if the student's question is answerable using ONLY the provided topic context (topic title, chapter, course, content).

Return ONLY minified JSON: {"relevant": true|false, "confidence": 0.0-1.0}

Rules:
- Greetings, smalltalk, "hi/hello/test/thanks" => relevant=false
- Questions about a different subject or clearly outside the topic => relevant=false
- Questions requiring knowledge not present or implied by the context => relevant=false
- Only mark true when the question is clearly about the given topic/chapter.
No prose, no code fences — JSON only.`,
          },
          {
            role: "user",
            content: `Topic context:\n${context}\n\nStudent question: ${trimmed}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    let relevant = false;
    let confidence = 0;
    if (classifyRes.ok) {
      try {
        const cJson = await classifyRes.json();
        const raw = cJson.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        relevant = parsed.relevant === true;
        confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
      } catch (e) {
        console.error("Classifier parse error:", e);
      }
    } else {
      console.error("Classifier call failed:", classifyRes.status, await classifyRes.text());
    }

    console.log("Classifier result:", { relevant, confidence });

    if (!relevant || confidence < 0.6) {
      const refusal = buildRefusal(topicTitle, chapterTitle);
      // log for admin review
      await supabase.from("doubt_logs").insert({
        student_id,
        topic_id,
        question: trimmed,
        answer: refusal,
        context_used: context.substring(0, 500),
        model_used: "guardrail",
        response_time_ms: Date.now(),
      });
      return refusalResponse(refusal);
    }

    // ============ STEP B: Answer (strict, context-bound) ============
    const refusalText = buildRefusal(topicTitle, chapterTitle);
    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are an expert AI tutor for SimpleLecture. Answer the student's question using ONLY the following topic context. If the context does not contain enough information to answer, respond with EXACTLY this text and nothing else:

"${refusalText}"

Topic context:
${context}

Guidelines when you can answer:
- Clear, step-by-step explanations in simple language
- Reference the course material
- Be encouraging and patient
- Never invent facts outside the context`,
          },
          { role: "user", content: trimmed },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices[0].message.content;

    // Log the interaction
    await supabase.from("doubt_logs").insert({
      student_id,
      topic_id,
      question: trimmed,
      answer,
      context_used: context.substring(0, 500),
      model_used: model,
      response_time_ms: Date.now(),
    });

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-doubt-clear:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
