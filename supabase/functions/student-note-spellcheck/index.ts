import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AIConfig = {
  enabled?: boolean;
  provider?: string;
  default_model?: string;
  openrouter_api_key?: string;
  google_api_key?: string;
  openai_api_key?: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const resolveProvider = (config: AIConfig) => {
  if (config?.enabled && config.provider === "openrouter" && config.openrouter_api_key) {
    return {
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: config.openrouter_api_key,
      model: config.default_model || "google/gemini-2.5-flash",
    };
  }
  if (config?.enabled && config.provider === "google" && config.google_api_key) {
    return {
      apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: config.google_api_key,
      model: config.default_model || "gemini-2.5-flash",
    };
  }
  if (config?.enabled && config.provider === "openai" && config.openai_api_key) {
    return {
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: config.openai_api_key,
      model: config.default_model || "gpt-4o-mini",
    };
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { text } = await req.json();
    const input = typeof text === "string" ? text.trim() : "";
    if (input.length < 3) return jsonResponse({ corrected_text: input, corrections: [] });
    if (input.length > 4000) return jsonResponse({ error: "Note is too long to check at once" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: aiConfigRow } = await adminClient
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", "ai_api_config")
      .maybeSingle();

    const provider = resolveProvider((aiConfigRow?.setting_value || {}) as AIConfig);
    if (!provider) return jsonResponse({ error: "Spellcheck service is not configured" }, 503);

    const aiResponse = await fetch(provider.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You are a spelling and basic grammar checker for student lecture notes. " +
              "Correct only clear spelling, punctuation, capitalization, and basic grammar errors. " +
              "Preserve meaning, formulas, line breaks, terminology, and the student's writing style. " +
              "Return strict JSON only: " +
              '{"corrected_text":"full corrected text","corrections":[{"original":"wrong text","replacement":"correct text","reason":"short reason"}]}. ' +
              "If there are no errors, return the original text and an empty corrections array.",
          },
          { role: "user", content: input },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("[student-note-spellcheck] provider error", aiResponse.status);
      return jsonResponse({ error: "Spellcheck is temporarily unavailable" }, 502);
    }

    const result = await aiResponse.json();
    const raw = String(result.choices?.[0]?.message?.content || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(raw);
    const correctedText =
      typeof parsed.corrected_text === "string" ? parsed.corrected_text : input;
    const corrections = Array.isArray(parsed.corrections)
      ? parsed.corrections
          .slice(0, 12)
          .map((item: Record<string, unknown>) => ({
            original: String(item?.original || "").trim(),
            replacement: String(item?.replacement || "").trim(),
            reason: String(item?.reason || "Spelling or grammar").trim(),
          }))
          .filter((item: { original: string; replacement: string }) =>
            item.original && item.replacement && item.original !== item.replacement
          )
      : [];

    return jsonResponse({
      corrected_text: correctedText,
      corrections: correctedText === input ? [] : corrections,
    });
  } catch (error) {
    console.error("[student-note-spellcheck]", error);
    return jsonResponse({ error: "Unable to check spelling" }, 500);
  }
});
