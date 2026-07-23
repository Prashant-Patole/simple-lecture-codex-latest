import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseName, shortDescription, detailedDescription, subjects } = await req.json();
    
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

    // Build context from course and subject information
    const subjectsContext = subjects?.map((s: any) => 
      `${s.name}: ${s.description || "No description"}`
    ).join("\n") || "No subjects provided";

    const systemPrompt = `You are an educational course FAQ generator. Generate 5-8 frequently asked questions with comprehensive answers for educational courses. Focus on:
- Course content and curriculum
- Prerequisites and target audience
- Learning outcomes and benefits
- Study materials and resources
- Assessment and certification
- Support and guidance available

Make answers detailed, helpful, and student-focused.`;

    const userPrompt = `Generate FAQs for this course:

Course Name: ${courseName}
Short Description: ${shortDescription || "Not provided"}
Detailed Description: ${detailedDescription || "Not provided"}

Subjects Covered:
${subjectsContext}

Return ONLY a valid JSON array of objects with this exact structure:
[
  {
    "question": "Question text here",
    "answer": "Detailed answer here"
  }
]`;

    console.log("Generating FAQs for course:", courseName);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content generated");
    }

    // Parse the JSON response
    let faqs;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      faqs = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse FAQs JSON:", content);
      throw new Error("Failed to parse generated FAQs");
    }

    if (!Array.isArray(faqs)) {
      throw new Error("Generated content is not an array");
    }

    console.log(`Generated ${faqs.length} FAQs successfully`);

    return new Response(JSON.stringify({ faqs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-generate-faqs:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate FAQs" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
