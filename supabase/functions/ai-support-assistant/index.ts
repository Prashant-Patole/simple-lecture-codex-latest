import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SYSTEM_PROMPT = `You are an AI Support Assistant for SimpleLecture LMS platform.

Your role:
- Help users with technical, account, payment, and platform-related issues.
- You must NOT answer academic, course subject, exam, or assignment questions.

Rules:
1. If a query is academic or course-related (like asking about a subject topic, exam answers, assignment solutions), politely redirect the user to the Forum: "This looks like a course-related question. Please use the Forum section for academic discussions where teachers and peers can help you better."
2. Provide clear, step-by-step solutions for support issues.
3. Ask the user if the issue is resolved at the end of your response.
4. If you are unsure or lack information, say so and indicate you'll escalate the ticket: "I'm not entirely sure about this. Let me escalate this to our support team for a more accurate response."
5. Do not guess or provide incorrect information.
6. Maintain a professional, polite, and concise tone.
7. Never claim to be human or replace admin authority.
8. Keep responses focused and actionable - don't be overly verbose.

You can help with:
- Login issues (password reset, access problems)
- Payment status (failed, pending, invoice)
- Course access issues
- App usage help
- Certificates, progress tracking
- General LMS navigation
- Technical issues (video not playing, app not loading)
- Account settings

Escalation Conditions:
- User indicates dissatisfaction
- You are unsure about the resolution
- Issue involves account security, payments, or system errors
- Complex issues requiring admin intervention

Response Format:
- Short explanation of the issue
- Clear action steps (numbered if multiple steps)
- Confirmation question

Example Ending:
"Please let me know if this resolves your issue. If not, I'll escalate this to our support team for further assistance."`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, ticketId, userId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    // Create Supabase client for database operations
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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
      console.error('[AI Support] No valid AI API configuration found');
      return new Response(
        JSON.stringify({ error: "AI API not configured. Please go to Admin → Settings → AI Functions API Key Settings to add your API key." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AI Support] Processing request for ticket: ${ticketId}, messages: ${messages.length}`);

    // Build conversation history for the AI
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("[AI Support] Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401 || response.status === 403) {
        console.error("[AI Support] Invalid API key");
        return new Response(JSON.stringify({ error: "Invalid or unauthorized API key. Please check your API key in Admin Settings." }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[AI Support] AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    console.log("[AI Support] Streaming response started");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("[AI Support] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
