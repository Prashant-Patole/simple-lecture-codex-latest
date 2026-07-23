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
    const { text, type, prompt, count } = await req.json();

    if (!text || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: text and type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const variantCount = Math.min(Math.max(Number(count) || 1, 1), 5);
    const customInstructions = typeof prompt === "string" && prompt.trim().length > 0 ? prompt.trim() : null;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    // Create appropriate system prompt based on type
    const systemPrompts: Record<string, string> = {
      chapter: "You are an expert educational content writer. Rephrase the given chapter title to make it more clear, engaging, and academically appropriate. Keep it concise (under 100 characters). Return only the rephrased text, nothing else.",
      topic: "You are an expert educational content writer. Rephrase the given topic title to make it more clear, engaging, and academically appropriate. Keep it concise (under 100 characters). Return only the rephrased text, nothing else.",
      question: "You are an expert in educational assessment. Rephrase the given question to make it clearer, more precise, and better formatted. Maintain the same difficulty level and intent. Return only the rephrased question, nothing else.",
      answer: "You are an expert in educational content. Rephrase the given answer to make it more clear and concise while maintaining accuracy. Return only the rephrased answer, nothing else.",
      explanation: "You are an expert educator. Rephrase the given explanation to make it clearer and more helpful for students. Keep it informative but accessible. Return only the rephrased explanation, nothing else.",
    };

    const systemPrompt = systemPrompts[type] || systemPrompts.question;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\n\nWhen multiple suggestions are requested, return ONLY a pure JSON array of strings (no markdown, no code fences).` },
            { role: "user", content: `Original Text:\n${text}\n\n${customInstructions ? `Additional Instructions:\n${customInstructions}\n\n` : ""}Please provide ${variantCount} high-quality rephrased variant${variantCount>1?"s":""}. Keep within constraints.` },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Invalid or unauthorized API key. Please check your API key in Admin Settings." }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI provider error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      throw new Error("No response from AI");
    }

    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        suggestions = parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch (_) {
      // Fallback: single suggestion
    }

    if (suggestions.length === 0) {
      suggestions = [raw];
    }

    return new Response(
      JSON.stringify({
        original: text,
        rephrased: suggestions[0],
        suggestions,
        type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-rephrase function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
