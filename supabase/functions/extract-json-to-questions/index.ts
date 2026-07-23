import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentJson, subjectId, chapterId, topicId, subtopicId, entityType, entityName } = await req.json();

    if (!contentJson || !subjectId || !chapterId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: contentJson, subjectId, chapterId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get AI configuration
    const { data: aiConfig } = await supabase
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_config')
      .maybeSingle();

    const config = aiConfig?.setting_value as any;

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
      return new Response(
        JSON.stringify({ error: 'AI API not configured. Please configure your API key in Admin Settings.', questionsCount: 0 }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subject info for category binding
    const { data: subjectData } = await supabase
      .from("popular_subjects")
      .select("category_id, name")
      .eq("id", subjectId)
      .single();

    const categoryId = subjectData?.category_id;

    // Extract content - prefer markdown, fall back to JSON string
    const content = typeof contentJson === "string"
      ? contentJson
      : contentJson.content_markdown || JSON.stringify(contentJson, null, 2);

    console.log("Extracting questions from:", entityType, entityName);
    console.log("Content length:", content.length);

    const extractionPrompt = `You are an expert at extracting ALL types of questions from educational documents.

Analyze the following document content and extract EVERY question found. Questions may be:
- **MCQ (Multiple Choice)**: Has options A, B, C, D
- **True/False**: Answer is True or False
- **Short Answer**: Brief 1-3 sentence answer
- **Long Answer**: Detailed answer with explanations, proofs, derivations, chemical equations, diagrams

**CRITICAL RULES:**
1. Extract ALL question types, not just MCQs
2. **PRESERVE the answer EXACTLY as written in the document** - do NOT generate or modify answers
3. Preserve ALL image references exactly as they appear (e.g., ![alt](filename.jpg))
4. Preserve ALL LaTeX/math formulas exactly as written
5. Preserve chemical equations, circuit diagrams descriptions, and scientific notation

For each question, return:
{
  "question_text": "The complete question text with any image refs and formulas preserved",
  "question_type": "mcq" | "subjective" | "true_false",
  "question_format": "single_choice" | "subjective" | "true_false",
  "options": { "A": { "text": "Option A text" }, "B": { "text": "Option B text" }, "C": { "text": "..." }, "D": { "text": "..." } } // null for non-MCQ
  "correct_answer": "For MCQ: the correct option text. For subjective: the FULL answer as written in document. For T/F: True or False",
  "explanation": "Solution/explanation if present, null otherwise. Preserve image refs here too.",
  "difficulty": "Low" | "Medium" | "Advanced",
  "marks": 1 | 2 | 4 | 5 (based on complexity - MCQ=1, short=2, long=4-5),
  "contains_formula": true | false (true if question or answer contains LaTeX, chemical formulas, or math expressions)
}

IMPORTANT: Do NOT repeat image alt/description text after the image markdown reference. Keep only the ![alt](filename) syntax.

Return ONLY a valid JSON array of question objects. If no questions found, return [].

Document content:
${content.substring(0, 80000)}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an expert at extracting structured question data from educational documents. Extract MCQs, short answer, and long answer questions. Preserve answers exactly as written. Always respond with valid JSON only." },
          { role: "user", content: extractionPrompt }
        ],
        max_tokens: 16000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM API error:", response.status, errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const llmResponse = data.choices?.[0]?.message?.content || "[]";

    console.log("LLM response preview:", llmResponse.substring(0, 500));

    // Parse the LLM response
    let extractedQuestions: any[] = [];
    try {
      let cleanedResponse = llmResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      extractedQuestions = JSON.parse(cleanedResponse);

      if (!Array.isArray(extractedQuestions)) {
        extractedQuestions = extractedQuestions.questions || [extractedQuestions];
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError);
      return new Response(
        JSON.stringify({
          error: "Failed to parse extracted questions",
          questionsCount: 0,
          details: "LLM response was not valid JSON"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (extractedQuestions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, questionsCount: 0, message: "No questions found in the document" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${extractedQuestions.length} questions to insert`);

    // Map and insert questions
    const questionsToInsert = extractedQuestions.map((q) => {
      // Normalize question type
      const rawType = (q.question_type || "").toLowerCase();
      let questionType = "mcq";
      let questionFormat = "single_choice";
      
      if (rawType === "subjective" || rawType === "short_answer" || rawType === "long_answer") {
        questionType = "subjective";
        questionFormat = "subjective";
      } else if (rawType === "true_false") {
        questionType = "true_false";
        questionFormat = "true_false";
      } else if (rawType === "mcq" || rawType === "single_choice" || rawType === "multiple_choice") {
        questionType = "mcq";
        questionFormat = q.question_format === "multiple_choice" ? "multiple_choice" : "single_choice";
      }

      // Normalize options to { A: { text: "..." } } format for MCQs
      let options = null;
      if (questionType === "mcq" && q.options) {
        const rawOptions = q.options;
        options = {} as any;
        if (typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
          for (const [key, value] of Object.entries(rawOptions)) {
            const upperKey = key.toUpperCase();
            if (typeof value === "string") {
              options[upperKey] = { text: value };
            } else if (typeof value === "object" && value !== null && (value as any).text) {
              options[upperKey] = { text: (value as any).text };
            }
          }
        } else if (Array.isArray(rawOptions)) {
          const keys = ["A", "B", "C", "D", "E", "F"];
          rawOptions.forEach((opt, idx) => {
            if (idx < keys.length) {
              options[keys[idx]] = { text: typeof opt === "string" ? opt : String(opt) };
            }
          });
        }
      }

      // Normalize difficulty
      const rawDiff = (q.difficulty || "Medium").toLowerCase();
      let difficulty = "Medium";
      if (rawDiff === "easy" || rawDiff === "low") difficulty = "Low";
      else if (rawDiff === "medium") difficulty = "Medium";
      else if (rawDiff === "intermediate") difficulty = "Intermediate";
      else if (rawDiff === "hard" || rawDiff === "advanced") difficulty = "Advanced";

      // Detect formulas
      const textToCheck = `${q.question_text || ""} ${q.correct_answer || ""} ${q.explanation || ""}`;
      const containsFormula = q.contains_formula || 
        textToCheck.includes('$') || 
        textToCheck.includes('\\(') || 
        textToCheck.includes('\\[') ||
        textToCheck.includes('\\frac') ||
        textToCheck.includes('\\sqrt');

      return {
        question_text: q.question_text || q.question || "",
        question_type: questionType,
        question_format: questionFormat,
        options: options,
        correct_answer: q.correct_answer || "",
        explanation: q.explanation || "",
        difficulty: difficulty,
        marks: q.marks || (questionType === "subjective" ? 4 : questionType === "true_false" ? 1 : 1),
        topic_id: topicId || null,
        subtopic_id: subtopicId || null,
        category_id: categoryId || null,
        contains_formula: containsFormula,
        is_verified: false,
        is_ai_generated: true,
        llm_verified: false,
        verification_status: "pending",
      };
    });

    const validQuestions = questionsToInsert.filter(q => q.question_text.trim().length > 0);

    if (validQuestions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, questionsCount: 0, message: "No valid questions found after parsing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("questions")
      .insert(validQuestions)
      .select("id");

    if (insertError) {
      console.error("Failed to insert questions:", insertError);
      throw new Error(`Database insert error: ${insertError.message}`);
    }

    // Count by type
    const typeCounts = validQuestions.reduce((acc, q) => {
      acc[q.question_type] = (acc[q.question_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`Successfully inserted ${insertedQuestions?.length || 0} questions:`, typeCounts);

    return new Response(
      JSON.stringify({
        success: true,
        questionsCount: insertedQuestions?.length || 0,
        message: `Extracted ${insertedQuestions?.length || 0} questions (${Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`).join(', ')})`,
        typeCounts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-json-to-questions:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        questionsCount: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
