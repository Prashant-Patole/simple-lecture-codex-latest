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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const WACTO_API_TOKEN = Deno.env.get("WACTO_API_TOKEN");
    if (!WACTO_API_TOKEN) throw new Error("WACTO_API_TOKEN not configured");

    const SENDER = "917353021234";

    // Get all enrolled students with phone numbers
    const { data: enrollments, error: enrollErr } = await supabase
      .from("enrollments")
      .select("student_id, profiles!inner(id, full_name, phone_number)")
      .eq("is_active", true);

    if (enrollErr) throw enrollErr;

    // Deduplicate by student_id
    const seen = new Set<string>();
    const students: { id: string; name: string; phone: string }[] = [];

    for (const e of enrollments || []) {
      const profile = (e as any).profiles;
      if (!profile?.phone_number || seen.has(profile.id)) continue;
      seen.add(profile.id);
      students.push({
        id: profile.id,
        name: profile.full_name || "Student",
        phone: profile.phone_number.replace(/\D/g, ""),
      });
    }

    console.log(`Sending daily nudge to ${students.length} students`);

    let sent = 0;
    let failed = 0;

    for (const student of students) {
      try {
        const phone = student.phone.startsWith("91") ? student.phone : `91${student.phone}`;

        const response = await fetch(
          `https://api.wacto.app/api/v1.0/messages/send-template/${SENDER}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WACTO_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: phone,
              type: "template",
              template: {
                name: "daily_doubt",
                language: { code: "en" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: student.name },
                    ],
                  },
                ],
              },
            }),
          }
        );

        if (response.ok) {
          sent++;
        } else {
          const errText = await response.text();
          console.error(`Failed for ${phone}: ${errText}`);
          failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        console.error(`Error sending to ${student.phone}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: students.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily nudge error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
