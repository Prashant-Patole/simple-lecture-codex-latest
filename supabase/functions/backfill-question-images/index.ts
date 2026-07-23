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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get optional offset param for pagination
    const { offset = 0, limit = 10 } = await req.json().catch(() => ({}));

    const { data: folders } = await supabase.storage
      .from("pdf-images")
      .list("", { limit: 500 });

    if (!folders) {
      return new Response(JSON.stringify({ inserted: 0, totalFolders: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Filter to only folders (items without metadata or with empty metadata)
    const folderItems = folders.filter(f => !f.metadata || Object.keys(f.metadata).length === 0);
    const batch = folderItems.slice(offset, offset + limit);
    
    console.log(`Processing folders ${offset} to ${offset + limit} of ${folderItems.length}`);

    const rows: any[] = [];

    for (const folder of batch) {
      const { data: files } = await supabase.storage
        .from("pdf-images")
        .list(folder.name, { limit: 1000 });

      if (!files) continue;
      console.log(`Folder ${folder.name}: ${files.length} files`);

      for (const file of files) {
        if (!file.name || !file.metadata || Object.keys(file.metadata).length === 0) continue;
        const storagePath = `${folder.name}/${file.name}`;
        rows.push({
          original_filename: file.name,
          storage_path: storagePath,
          public_url: `${supabaseUrl}/storage/v1/object/public/pdf-images/${storagePath}`,
          datalab_request_id: folder.name,
        });
      }
    }

    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error, count } = await supabase
        .from("question_images")
        .upsert(chunk, { onConflict: "storage_path", ignoreDuplicates: true, count: "exact" });

      if (error) console.error("Insert error:", error.message);
      else totalInserted += count || chunk.length;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalFolders: folderItems.length,
        processedFolders: batch.length,
        offset,
        nextOffset: offset + limit < folderItems.length ? offset + limit : null,
        filesFound: rows.length, 
        inserted: totalInserted 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
