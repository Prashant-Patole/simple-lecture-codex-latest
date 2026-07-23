import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuestionToGrade {
  question_id: string;
  question: string;
  type: string;
  correct_answer: string;
  student_answer: string;
  marks: number;
}

interface GradedAnswer {
  question_id: string;
  marks_awarded: number;
  feedback: string;
  is_correct: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questions }: { questions: QuestionToGrade[] } = await req.json();

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No questions provided for grading" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client to fetch AI config
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        JSON.stringify({ error: 'AI API not configured. Please configure your API key in Admin Settings.' }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format questions for grading
    const questionsText = questions.map((q, i) => `
Question ${i + 1} (ID: ${q.question_id}, Type: ${q.type}, Max Marks: ${q.marks}):
${q.question}

Expected Answer: ${q.correct_answer}

Student's Answer: ${q.student_answer || "(No answer provided)"}
`).join("\n---\n");

    const systemPrompt = `You are a strict but fair teacher grading student assignment answers.

For each question, you must:
1. Compare the student's answer with the expected answer
2. Award marks based on correctness:
   - Full marks for essentially correct answers
   - Partial marks for partially correct answers (award proportionally)
   - 0 marks for incorrect, irrelevant, or blank answers
3. Provide brief, constructive feedback (1-2 sentences)
4. Mark as correct only if the answer is substantially correct

Important:
- For MCQ/True-False: Only full marks (exact match) or 0 marks
- For short/long answers: Consider meaning, not exact wording
- Be strict but fair with partial marks
- Empty or "(No answer provided)" answers get 0 marks

Respond with a JSON array in this exact format:
[
  {
    "question_id": "q_0",
    "marks_awarded": 2,
    "feedback": "Correct explanation of the concept.",
    "is_correct": true
  }
]

Only output the JSON array, no additional text.`;

    console.log("Calling AI for grading...");

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
          { role: "user", content: `Grade the following answers:\n\n${questionsText}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Invalid or unauthorized API key. Please check your API key in Admin Settings.' }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    console.log("AI response:", content);

    // Parse the JSON response
    let gradedAnswers: GradedAnswer[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }
      gradedAnswers = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      
      gradedAnswers = questions.map(q => ({
        question_id: q.question_id,
        marks_awarded: 0,
        feedback: "Unable to grade automatically. Please review manually.",
        is_correct: false,
      }));
    }

    // Validate and sanitize grades
    const validatedGrades = questions.map(q => {
      const graded = gradedAnswers.find(g => g.question_id === q.question_id);
      if (!graded) {
        return {
          question_id: q.question_id,
          marks_awarded: 0,
          feedback: "Answer not graded.",
          is_correct: false,
        };
      }
      
      const marksAwarded = Math.min(Math.max(0, graded.marks_awarded || 0), q.marks);
      
      return {
        question_id: q.question_id,
        marks_awarded: marksAwarded,
        feedback: graded.feedback || "",
        is_correct: graded.is_correct || marksAwarded === q.marks,
      };
    });

    const totalMarksAwarded = validatedGrades.reduce((sum, g) => sum + g.marks_awarded, 0);
    const totalMaxMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    console.log(`Grading complete: ${totalMarksAwarded}/${totalMaxMarks}`);

    return new Response(
      JSON.stringify({
        grades: validatedGrades,
        total_marks_awarded: totalMarksAwarded,
        total_max_marks: totalMaxMarks,
        percentage: totalMaxMarks > 0 ? Math.round((totalMarksAwarded / totalMaxMarks) * 100) : 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Grading error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to grade assignment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
