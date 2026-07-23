import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subjectId, chapterId, topicId, config, instructions } = await req.json();

    console.log("🎯 Generating AI Assignment:", { subjectId, chapterId, topicId, config });

    if (!subjectId || !chapterId) {
      return new Response(
        JSON.stringify({ error: "Subject ID and Chapter ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get AI API configuration from database
    const { data: aiConfig } = await supabase
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_config')
      .maybeSingle();

    const aiApiConfig = aiConfig?.setting_value as any;

    // Determine API endpoint and key based on settings
    let apiUrl: string, apiKey: string, model: string;
    if (aiApiConfig?.enabled && aiApiConfig?.provider === 'openrouter' && aiApiConfig?.openrouter_api_key) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = aiApiConfig.openrouter_api_key;
      model = aiApiConfig.default_model || "google/gemini-2.5-flash";
      console.log('Using OpenRouter with model:', model);
    } else if (aiApiConfig?.enabled && aiApiConfig?.provider === 'google' && aiApiConfig?.google_api_key) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = aiApiConfig.google_api_key;
      model = aiApiConfig.default_model || "gemini-2.5-flash";
      console.log('Using custom Google AI API with model:', model);
    } else if (aiApiConfig?.enabled && aiApiConfig?.provider === 'openai' && aiApiConfig?.openai_api_key) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = aiApiConfig.openai_api_key;
      model = aiApiConfig.default_model || "gpt-4o-mini";
      console.log('Using custom OpenAI API with model:', model);
    } else {
      console.error('❌ No valid AI API configuration found');
      return new Response(
        JSON.stringify({ error: "AI API not configured. Please go to Admin → Settings → AI Functions API Key Settings to add your API key." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch chapter info
    const { data: chapter } = await supabase
      .from("subject_chapters")
      .select("name")
      .eq("id", chapterId)
      .single();

    // Fetch topic info if provided
    let topicName = "";
    if (topicId) {
      const { data: topic } = await supabase
        .from("subject_topics")
        .select("name")
        .eq("id", topicId)
        .single();
      topicName = topic?.name || "";
    }

    // Fetch documents for context
    let docsQuery = supabase
      .from("ai_assistant_documents")
      .select("display_name, content_preview, full_content")
      .eq("subject_id", subjectId)
      .eq("chapter_id", chapterId);

    if (topicId) {
      docsQuery = docsQuery.eq("topic_id", topicId);
    }

    const { data: documents } = await docsQuery;

    // Build context from documents
    let documentContext = "";
    if (documents && documents.length > 0) {
      documentContext = documents
        .map((doc) => {
          const content = doc.full_content 
            ? (typeof doc.full_content === "string" ? doc.full_content : JSON.stringify(doc.full_content))
            : doc.content_preview || "";
          return `Document: ${doc.display_name}\n${content.substring(0, 2000)}`;
        })
        .join("\n\n---\n\n");
    }

    // Fetch existing questions for reference
    let questionsQuery = supabase
      .from("questions")
      .select("question_text, options, correct_answer, difficulty, marks")
      .eq("subject_id", subjectId)
      .eq("chapter_id", chapterId)
      .limit(20);

    if (topicId) {
      questionsQuery = questionsQuery.eq("topic_id", topicId);
    }

    const { data: existingQuestions } = await questionsQuery;

    const existingQuestionsContext = existingQuestions?.length
      ? `\n\nExisting questions for reference (avoid duplicates):\n${existingQuestions
          .map((q) => `- ${q.question_text}`)
          .join("\n")}`
      : "";

    const { difficultyMix, questionTypes, totalMarks, durationMinutes } = config;

    const systemPrompt = `You are an expert educational content creator generating assignments for students.

ASSIGNMENT CREATION GUIDELINES:
1. 🎯 Clear Objective - Each question should test specific learning outcomes from the chapter/topic
2. 📚 Syllabus Alignment - Stay within the chapter/topic scope provided
3. 🧠 Difficulty Mix - Follow this distribution: Easy ${difficultyMix.easy}%, Medium ${difficultyMix.medium}%, Hard ${difficultyMix.hard}%
4. 🔄 Question Variety - Include these types: ${questionTypes.join(", ")}
5. ⏱️ Time Appropriate - Total questions should fit within ${durationMinutes} minutes
6. 🧩 Critical Thinking - Include "Why?", "What if?", "Compare/Analyze" questions for hard difficulty
7. 🌍 Real-World Connection - Relate questions to daily life examples where applicable
8. 📏 Clear Format - Assign marks per question based on difficulty and type

DIFFICULTY LEVELS:
- Easy: Basic understanding, recall, definitions (1-2 marks typically)
- Medium: Application, problem-solving, explanations (3-4 marks typically)  
- Hard: Analysis, synthesis, evaluation, critical thinking (5+ marks typically)

QUESTION TYPES TO GENERATE:
${questionTypes.map((t: string) => {
  switch (t) {
    case "mcq": return "- MCQ: Multiple choice with 4 options, mark correct answer";
    case "short_answer": return "- Short Answer: 2-3 sentence responses";
    case "long_answer": return "- Long Answer: Paragraph responses requiring explanation";
    case "true_false": return "- True/False: Statement with correct answer";
    case "fill_blank": return "- Fill in the Blanks: Sentence with blank to fill";
    case "diagram": return "- Diagram Based: Questions requiring visual interpretation";
    case "case_study": return "- Case Study: Scenario-based analytical questions";
    case "application": return "- Real-world Application: Practical application questions";
    default: return "";
  }
}).join("\n")}

OUTPUT FORMAT (JSON array):
[
  {
    "question": "Question text here",
    "type": "mcq|short_answer|long_answer|true_false|fill_blank|diagram|case_study|application",
    "difficulty": "easy|medium|hard",
    "marks": number,
    "options": ["A", "B", "C", "D"] (only for MCQ),
    "correct_answer": "Correct answer or option",
    "explanation": "Brief explanation of the answer"
  }
]

Generate questions totaling exactly ${totalMarks} marks.
${instructions ? `\nAdditional Instructions: ${instructions}` : ""}`;

    const userPrompt = `Create an assignment for:
Chapter: ${chapter?.name || "Unknown"}
${topicName ? `Topic: ${topicName}` : "Cover the entire chapter"}
Total Marks: ${totalMarks}
Duration: ${durationMinutes} minutes

${documentContext ? `REFERENCE MATERIAL:\n${documentContext}` : "No reference documents available. Generate based on general knowledge of the chapter/topic."}
${existingQuestionsContext}

Generate a well-balanced assignment following all the guidelines. Output ONLY the JSON array.`;

    console.log("📝 Sending to AI API...");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);

      const friendly =
        response.status === 429
          ? "Rate limit exceeded. Please wait a moment and try again."
          : response.status === 401 || response.status === 403
            ? "Invalid or unauthorized API key. Please check your API key in Admin Settings."
            : "AI provider error. Please try again.";

      return new Response(JSON.stringify({ error: friendly }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    console.log("✅ AI response received");

    // Parse the JSON response
    let questions;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI-generated questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = `${chapter?.name || "Chapter"}${topicName ? ` - ${topicName}` : ""} Assignment`;

    return new Response(
      JSON.stringify({
        success: true,
        title,
        questions,
        totalQuestions: questions.length,
        totalMarks: questions.reduce((sum: number, q: any) => sum + (q.marks || 0), 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ AI Assignment Generation Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate assignment";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
