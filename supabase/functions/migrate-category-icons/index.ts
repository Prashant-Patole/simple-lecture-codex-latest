import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting category icon migration...");

    // Fetch all categories with base64 icons
    const { data: categories, error: fetchError } = await supabase
      .from("categories")
      .select("id, name, icon")
      .not("icon", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const results: { id: string; name: string; status: string; url?: string }[] = [];

    for (const category of categories || []) {
      // Skip if icon is not base64
      if (!category.icon?.startsWith("data:image")) {
        skipped++;
        results.push({ id: category.id, name: category.name, status: "skipped" });
        continue;
      }

      try {
        // Parse base64 data URL
        const matches = category.icon.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          console.log(`Invalid base64 format for category ${category.id}`);
          errors++;
          results.push({ id: category.id, name: category.name, status: "invalid_format" });
          continue;
        }

        const [, ext, base64Data] = matches;
        const fileExt = ext === "jpeg" ? "jpg" : ext;
        const fileName = `${category.id}/icon_${Date.now()}.${fileExt}`;

        // Decode base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("category-icons")
          .upload(fileName, bytes.buffer, {
            contentType: `image/${ext}`,
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for category ${category.id}:`, uploadError);
          errors++;
          results.push({ id: category.id, name: category.name, status: "upload_failed" });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("category-icons")
          .getPublicUrl(uploadData.path);

        // Update category with new URL
        const { error: updateError } = await supabase
          .from("categories")
          .update({ icon: urlData.publicUrl })
          .eq("id", category.id);

        if (updateError) {
          console.error(`Update failed for category ${category.id}:`, updateError);
          errors++;
          results.push({ id: category.id, name: category.name, status: "update_failed" });
          continue;
        }

        migrated++;
        results.push({ id: category.id, name: category.name, status: "migrated", url: urlData.publicUrl });
        console.log(`Migrated category ${category.name}: ${urlData.publicUrl}`);

      } catch (err) {
        console.error(`Error processing category ${category.id}:`, err);
        errors++;
        results.push({ id: category.id, name: category.name, status: "error" });
      }
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: { migrated, skipped, errors, total: categories?.length || 0 },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Migration failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
