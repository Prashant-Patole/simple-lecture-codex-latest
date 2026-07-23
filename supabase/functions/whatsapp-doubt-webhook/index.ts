import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER = "917353021234";
const SITE_URL = "https://simplelecture.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Webhook payload:", JSON.stringify(payload));

    // Extract message from Wacto webhook payload
    const message = payload?.message || payload?.messages?.[0] || payload;
    const phoneRaw = message?.from || message?.sender || message?.phone || payload?.from;
    const questionText = message?.text?.body || message?.body || message?.text || payload?.text?.body || payload?.body;

    if (!phoneRaw || !questionText) {
      console.log("No phone or message text found in payload");
      return new Response(JSON.stringify({ status: "ignored", reason: "no phone or text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = phoneRaw.replace(/\D/g, "");
    console.log(`Received question from ${phone}: ${questionText}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const WACTO_API_TOKEN = Deno.env.get("WACTO_API_TOKEN");
    if (!WACTO_API_TOKEN) throw new Error("WACTO_API_TOKEN not configured");

    // Lookup student by phone number
    const phoneVariants = [phone, phone.replace(/^91/, ""), `+${phone}`];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone_number")
      .in("phone_number", phoneVariants)
      .limit(1);

    const student = profiles?.[0];
    const studentName = student?.full_name || "Student";
    const studentId = student?.id || null;

    // Get AI configuration from ai_settings (ai_api_config row)
    const { data: aiSettingsRow } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", "ai_api_config")
      .maybeSingle();
    const aiCfg = (aiSettingsRow?.setting_value || {}) as any;

    // Legacy fallback row
    const { data: legacyRow } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", "google_api_key")
      .maybeSingle();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const openrouterKey = aiCfg?.openrouter_api_key || null;
    const googleApiKey = aiCfg?.google_api_key || (legacyRow?.setting_value as any)?.key || (legacyRow?.setting_value as any)?.api_key || null;

    let aiAnswer = "";

    // Primary: OpenRouter (admin-configured)
    if (!aiAnswer && openrouterKey) {
      try {
        const orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://simplelecture.com",
            "X-Title": "SimpleLecture",
          },
          body: JSON.stringify({
            model: aiCfg.default_model || "google/gemini-2.5-flash",
            messages: [
              { role: "user", content: `You are an expert tutor for Indian students. The student's name is ${studentName}. Answer the following question clearly and concisely. Use simple language. If it involves math or science, show step-by-step solutions. Keep the answer under 500 words.\n\nQuestion: ${questionText}` },
            ],
            temperature: 0.3,
          }),
        });
        if (orResp.ok) {
          const orData = await orResp.json();
          aiAnswer = orData.choices?.[0]?.message?.content || "";
        } else {
          console.error("OpenRouter error:", await orResp.text());
        }
      } catch (e) {
        console.error("OpenRouter fetch failed:", e);
      }
    }

    if (!aiAnswer && googleApiKey) {
      // Fallback to Gemini direct
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are an expert tutor for Indian students. The student's name is ${studentName}. Answer the following question clearly and concisely. Use simple language. If it involves math or science, show step-by-step solutions. Keep the answer under 500 words.\n\nQuestion: ${questionText}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        aiAnswer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        console.error("Gemini error:", await geminiResponse.text());
      }
    }

    // Fallback to Lovable AI Gateway
    if (!aiAnswer && LOVABLE_API_KEY) {
      const gatewayResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `You are an expert tutor for Indian students. The student's name is ${studentName}. Answer questions clearly and concisely. Use simple language. Show step-by-step solutions for math/science. Keep answers under 500 words.`,
            },
            { role: "user", content: questionText },
          ],
        }),
      });

      if (gatewayResponse.ok) {
        const data = await gatewayResponse.json();
        aiAnswer = data.choices?.[0]?.message?.content || "";
      } else {
        console.error("Gateway error:", gatewayResponse.status, await gatewayResponse.text());
      }
    }

    if (!aiAnswer) {
      aiAnswer = "Sorry, I couldn't process your question right now. Please try again later or contact support.";
    }

    // Save to whatsapp_chat_logs
    const { data: logEntry, error: logErr } = await supabase
      .from("whatsapp_chat_logs")
      .insert({
        phone_number: phone,
        student_id: studentId,
        direction: "inbound",
        message_text: questionText,
        ai_answer: aiAnswer,
      })
      .select("id")
      .single();

    if (logErr) console.error("Log insert error:", logErr);

    // Truncate answer for WhatsApp (max ~4000 chars)
    const whatsappAnswer = aiAnswer.length > 3500
      ? aiAnswer.substring(0, 3500) + "...\n\n(Full answer available on the link below)"
      : aiAnswer;

    // Send answer via Wacto
    const recipientPhone = phone.startsWith("91") ? phone : `91${phone}`;

    await fetch(`https://api.wacto.app/api/v1.0/messages/send/${SENDER}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WACTO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: recipientPhone,
        type: "text",
        text: { body: whatsappAnswer },
      }),
    });

    // Send follow-up message with web link
    if (logEntry?.id) {
      await new Promise((r) => setTimeout(r, 1000)); // Small delay between messages

      const webUrl = `${SITE_URL}/doubt/${logEntry.id}`;
      await fetch(`https://api.wacto.app/api/v1.0/messages/send/${SENDER}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WACTO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: recipientPhone,
          type: "text",
          text: {
            body: `📖 View the full answer with proper formatting on our website:\n${webUrl}`,
          },
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, logId: logEntry?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
