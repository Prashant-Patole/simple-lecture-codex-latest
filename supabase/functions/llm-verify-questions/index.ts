import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionIds } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get AI configuration from database
    const { data: aiConfig } = await supabaseAdmin
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
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch questions to verify
    const { data: questions, error: fetchError } = await supabaseAdmin
      .from('parsed_questions_pending')
      .select('*')
      .in('id', questionIds);

    if (fetchError) throw fetchError;

    const verificationResults = [];

    // Verify each question with LLM
    for (const question of questions) {
      const systemPrompt = `You are an expert educational content validator.

Analyze the question and verify:
1. Question clarity and grammar
2. Answer options quality
3. Correct answer accuracy
4. Explanation quality
5. **Difficulty level appropriateness** (is the assigned difficulty accurate?)

Respond with JSON:
{
  "status": "correct" | "medium" | "wrong",
  "confidence": 0.85,
  "comments": "Overall assessment",
  "issues": ["specific issues"],
  "difficulty_assessment": {
    "is_appropriate": true,
    "suggested_difficulty": "Medium",
    "reasoning": "Question requires multi-step calculation, appropriate for Medium"
  }
}`;

      const userPrompt = `Question: ${question.question_text}
Format: ${question.question_format}
Options: ${JSON.stringify(question.options || {})}
Correct Answer: ${question.correct_answer}
Explanation: ${question.explanation || 'None'}
Current Difficulty: ${question.difficulty}`;

      const aiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!aiResponse.ok) {
        console.error('LLM verification failed:', await aiResponse.text());
        continue;
      }

      const aiData = await aiResponse.json();
      const verification = JSON.parse(aiData.choices[0].message.content);

      // Update question with LLM verification
      await supabaseAdmin
        .from('parsed_questions_pending')
        .update({
          llm_verified: true,
          llm_verification_status: verification.status,
          llm_confidence_score: verification.confidence,
          llm_verification_comments: verification.comments,
          llm_issues: verification.issues || [],
          llm_verified_at: new Date().toISOString()
        })
        .eq('id', question.id);

      verificationResults.push({
        questionId: question.id,
        status: verification.status,
        confidence: verification.confidence
      });
    }

    return new Response(
      JSON.stringify({ success: true, results: verificationResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying questions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
