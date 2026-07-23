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
    const { questionId } = await req.json();
    console.log('Generating solution for question:', questionId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch question details
    const { data: question, error: questionError } = await supabaseClient
      .from('parsed_questions_pending')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError) throw questionError;

    // Get AI configuration from database
    const { data: aiConfig } = await supabaseClient
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

    const prompt = `You are an expert educator. Generate a clear, step-by-step solution for the following question:

Question: ${question.question_text}

Question Type: ${question.question_format}
Difficulty: ${question.difficulty}
${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}
Correct Answer: ${question.correct_answer}

Provide a detailed explanation that:
1. Explains the concept involved
2. Shows step-by-step working
3. Explains why the correct answer is right
4. If applicable, explains why other options are wrong

Format the solution clearly with numbered steps and explanations.`;

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an expert educator who provides clear, detailed explanations.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedSolution = aiData.choices[0].message.content;

    // Update question with generated solution
    const { error: updateError } = await supabaseClient
      .from('parsed_questions_pending')
      .update({
        explanation: generatedSolution,
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        solution: generatedSolution 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating solution:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
