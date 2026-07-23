import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckAnswerRequest {
  question_id: string;
  question_text: string;
  question_type: string;
  correct_answer: string;
  student_answer: string;
  max_marks?: number;
}

interface CheckAnswerResponse {
  is_correct: boolean;
  marks_awarded: number;
  similarity_score: number;
  feedback: string;
}

async function callAI(apiUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<Response> {
  return await fetch(apiUrl, {
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
      temperature: 0.1,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      question_id, 
      question_text, 
      question_type, 
      correct_answer, 
      student_answer,
      max_marks = 1 
    }: CheckAnswerRequest = await req.json();

    console.log(`[ai-check-answer] Checking answer for question ${question_id}`);
    console.log(`[ai-check-answer] Question type: ${question_type}`);
    console.log(`[ai-check-answer] Correct answer: ${correct_answer?.substring(0, 100)}...`);
    console.log(`[ai-check-answer] Student answer: ${student_answer?.substring(0, 100)}...`);

    // Check if student answer is a placeholder from failed image extraction
    if (student_answer?.startsWith("[Image answer uploaded")) {
      console.log("[ai-check-answer] Image extraction failed placeholder detected - skipping AI grading");
      return new Response(
        JSON.stringify({
          is_correct: false,
          marks_awarded: 0,
          similarity_score: 0,
          feedback: "Image could not be read by AI. Please re-upload a clearer image or type your answer.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!student_answer || !student_answer.trim()) {
      return new Response(
        JSON.stringify({
          is_correct: false,
          marks_awarded: 0,
          similarity_score: 0,
          feedback: "No answer provided.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!correct_answer || !correct_answer.trim()) {
      return new Response(
        JSON.stringify({
          is_correct: false,
          marks_awarded: 0,
          similarity_score: 0,
          feedback: "Unable to evaluate - no correct answer available.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Quick exact match check (case-insensitive, trimmed)
    const normalizedStudent = student_answer.trim().toLowerCase();
    const normalizedCorrect = correct_answer.trim().toLowerCase();
    
    if (normalizedStudent === normalizedCorrect) {
      console.log("[ai-check-answer] Exact match found");
      return new Response(
        JSON.stringify({
          is_correct: true,
          marks_awarded: max_marks,
          similarity_score: 100,
          feedback: "Correct answer!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For MCQ single letters
    if (question_type === "mcq" || question_type === "single_choice") {
      const studentLetter = normalizedStudent.replace(/[^a-d]/gi, "").toLowerCase();
      const correctLetter = normalizedCorrect.replace(/[^a-d]/gi, "").toLowerCase();
      
      if (studentLetter.length === 1 && correctLetter.length === 1) {
        const isCorrect = studentLetter === correctLetter;
        return new Response(
          JSON.stringify({
            is_correct: isCorrect,
            marks_awarded: isCorrect ? max_marks : 0,
            similarity_score: isCorrect ? 100 : 0,
            feedback: isCorrect ? "Correct option selected!" : `Incorrect. The correct answer is ${correct_answer.toUpperCase()}.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For integer/numerical questions
    if (question_type === "integer" || question_type === "numerical") {
      const studentNum = parseFloat(student_answer.replace(/[^\d.-]/g, ""));
      const correctNum = parseFloat(correct_answer.replace(/[^\d.-]/g, ""));
      
      if (!isNaN(studentNum) && !isNaN(correctNum)) {
        const isCorrect = Math.abs(studentNum - correctNum) < 0.001;
        return new Response(
          JSON.stringify({
            is_correct: isCorrect,
            marks_awarded: isCorrect ? max_marks : 0,
            similarity_score: isCorrect ? 100 : 0,
            feedback: isCorrect ? "Correct numerical answer!" : `Incorrect. The correct answer is ${correct_answer}.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build the evaluation prompts
    const systemPrompt = `You are an expert exam evaluator. Your task is to compare a student's answer with the correct answer and determine if they are semantically equivalent.

EVALUATION CRITERIA:
1. Semantic equivalence - Does the answer convey the same meaning? (not exact wording)
2. Mathematical equivalence - "2" = "2.0" = "two" = "II"
3. Scientific notation equivalence - "H2O" = "water" = "dihydrogen monoxide"
4. Consider alternative correct formulations
5. For partial answers, award partial credit proportionally

SCORING:
- Full marks: Answer is semantically correct (even if worded differently)
- Partial marks: Answer is partially correct or contains the key concept
- Zero marks: Answer is incorrect or unrelated

Respond ONLY with valid JSON in this exact format:
{
  "is_correct": boolean,
  "marks_awarded": number (0 to ${max_marks}),
  "similarity_score": number (0 to 100),
  "feedback": "Brief explanation of the evaluation"
}`;

    const userPrompt = `Question: ${question_text}

Correct Answer: ${correct_answer}

Student's Answer: ${student_answer}

Maximum Marks: ${max_marks}

Evaluate the student's answer and provide your assessment.`;

    console.log("[ai-check-answer] Calling AI for semantic comparison");

    // Try Lovable AI first
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let response: Response | null = null;

    if (LOVABLE_API_KEY) {
      response = await callAI(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        LOVABLE_API_KEY,
        "google/gemini-3-flash-preview",
        systemPrompt,
        userPrompt
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ai-check-answer] Lovable AI error:", response.status, errorText);
        response = null; // will try admin key fallback
      }
    }

    // Fallback: try admin-configured API key
    if (!response || !response.ok) {
      console.log("[ai-check-answer] Trying admin-configured API key as fallback");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: aiConfig } = await supabase
        .from("ai_settings")
        .select("setting_value")
        .eq("setting_key", "ai_api_config")
        .maybeSingle();

      const config = aiConfig?.setting_value as any;

    if (config?.enabled && config?.provider === "openrouter" && config?.openrouter_api_key) {
      const orModel = config.default_model || "google/gemini-2.5-flash";
      console.log("[ai-check-answer] Using admin OpenRouter API key, model:", orModel);
      response = await callAI(
        "https://openrouter.ai/api/v1/chat/completions",
        config.openrouter_api_key,
        orModel,
        systemPrompt,
        userPrompt
      );
      if (!response.ok) {
        const errText = await response.text();
        console.error("[ai-check-answer] Admin OpenRouter error:", response.status, errText);
        response = null;
      }
    } else if (config?.enabled && config?.provider === "google" && config?.google_api_key) {
      const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      const primaryModel = config.default_model || "gemini-2.5-flash";
      const googleApiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

      console.log("[ai-check-answer] Using admin Google API key, model:", primaryModel);
      response = await callAI(googleApiUrl, config.google_api_key, primaryModel, systemPrompt, userPrompt);

      // Retry once on 503/429
      if (response && (response.status === 503 || response.status === 429)) {
        const errText = await response.text();
        console.log("[ai-check-answer] Got", response.status, "- retrying after 2s...", errText);
        await new Promise(r => setTimeout(r, 2000));
        response = await callAI(googleApiUrl, config.google_api_key, primaryModel, systemPrompt, userPrompt);
      }

      // Try fallback models if still failing
      if (response && !response.ok) {
        const errText = await response.text();
        console.error("[ai-check-answer] Primary model failed:", response.status, errText);
        response = null;

        for (const fallbackModel of FALLBACK_MODELS) {
          console.log("[ai-check-answer] Trying fallback model:", fallbackModel);
          const fbResponse = await callAI(googleApiUrl, config.google_api_key, fallbackModel, systemPrompt, userPrompt);
          if (fbResponse.ok) {
            response = fbResponse;
            console.log("[ai-check-answer] Fallback model succeeded:", fallbackModel);
            break;
          }
          const fbErr = await fbResponse.text();
          console.error("[ai-check-answer] Fallback", fallbackModel, "failed:", fbResponse.status, fbErr);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } else if (config?.enabled && config?.provider === "openai" && config?.openai_api_key) {
      console.log("[ai-check-answer] Using admin OpenAI API key");
      response = await callAI(
        "https://api.openai.com/v1/chat/completions",
        config.openai_api_key,
        config.default_model || "gpt-4o-mini",
        systemPrompt,
        userPrompt
      );
      if (!response.ok) {
        const errText = await response.text();
        console.error("[ai-check-answer] Admin OpenAI API error:", response.status, errText);
        response = null;
      }
    }
    }

    // If all AI calls failed, fall back to basic similarity
    if (!response || !response.ok) {
      console.log("[ai-check-answer] All AI providers failed, using basic similarity");
      const similarity = calculateSimpleSimilarity(normalizedStudent, normalizedCorrect);
      const isCorrect = similarity >= 70;
      return new Response(
        JSON.stringify({
          is_correct: isCorrect,
          marks_awarded: isCorrect ? max_marks : Math.round(max_marks * similarity / 100),
          similarity_score: similarity,
          feedback: isCorrect 
            ? "Answer appears correct based on keyword matching." 
            : `Answer partially matches (${similarity}% similarity). AI grading unavailable.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[ai-check-answer] No content in AI response");
      return new Response(
        JSON.stringify({
          is_correct: false,
          marks_awarded: 0,
          similarity_score: 0,
          feedback: "Unable to evaluate answer.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the AI response
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonStr = objectMatch[0];
        }
      }

      const result: CheckAnswerResponse = JSON.parse(jsonStr);
      
      const normalizedResult: CheckAnswerResponse = {
        is_correct: Boolean(result.is_correct),
        marks_awarded: Math.min(Math.max(0, Number(result.marks_awarded) || 0), max_marks),
        similarity_score: Math.min(Math.max(0, Number(result.similarity_score) || 0), 100),
        feedback: String(result.feedback || "Answer evaluated."),
      };

      console.log("[ai-check-answer] Evaluation result:", normalizedResult);

      return new Response(
        JSON.stringify(normalizedResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("[ai-check-answer] Failed to parse AI response:", parseError, content);
      
      const lowerContent = content.toLowerCase();
      const isCorrect = lowerContent.includes("correct") && !lowerContent.includes("incorrect");
      
      return new Response(
        JSON.stringify({
          is_correct: isCorrect,
          marks_awarded: isCorrect ? max_marks : 0,
          similarity_score: isCorrect ? 80 : 20,
          feedback: "Answer evaluated.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[ai-check-answer] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        is_correct: false,
        marks_awarded: 0,
        similarity_score: 0,
        feedback: "Error evaluating answer.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateSimpleSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 100;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }
  
  const union = words1.size + words2.size - intersection;
  return Math.round((intersection / union) * 100);
}
