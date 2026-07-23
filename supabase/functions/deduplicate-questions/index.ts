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

    const { subjectId, chapterId, topicId } = await req.json().catch(() => ({}));

    console.log("Starting deduplication...", { subjectId, chapterId, topicId });

    // Fetch all questions with optional filters
    let query = supabase
      .from("questions")
      .select("id, question_text, chapter_id, topic_id, created_at")
      .order("created_at", { ascending: true });

    if (topicId) {
      query = query.eq("topic_id", topicId);
    } else if (chapterId) {
      // Get topics for this chapter
      const { data: topics } = await supabase
        .from("subject_topics")
        .select("id")
        .eq("chapter_id", chapterId);
      
      if (topics && topics.length > 0) {
        query = query.in("topic_id", topics.map(t => t.id));
      }
    } else if (subjectId) {
      // Get all topics for this subject
      const { data: chapters } = await supabase
        .from("subject_chapters")
        .select("id")
        .eq("subject_id", subjectId);
      
      if (chapters && chapters.length > 0) {
        const { data: topics } = await supabase
          .from("subject_topics")
          .select("id")
          .in("chapter_id", chapters.map(c => c.id));
        
        if (topics && topics.length > 0) {
          query = query.in("topic_id", topics.map(t => t.id));
        }
      }
    }

    const { data: questions, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          duplicatesRemoved: 0,
          message: "No questions found to deduplicate" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${questions.length} questions to check for duplicates`);

    // Find duplicates based on exact text match (case-insensitive, trimmed)
    const seen = new Map<string, string>(); // normalized text -> first question id
    const duplicateIds: string[] = [];

    for (const question of questions) {
      const normalizedText = (question.question_text || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "); // Normalize whitespace
      
      // Create a key that includes topic/chapter for scoped deduplication
      const key = `${normalizedText}|${question.topic_id || ""}|${question.chapter_id || ""}`;
      
      if (seen.has(key)) {
        duplicateIds.push(question.id);
      } else {
        seen.set(key, question.id);
      }
    }

    console.log(`Found ${duplicateIds.length} duplicate questions`);

    if (duplicateIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          duplicatesRemoved: 0,
          message: "No duplicates found" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete duplicates in batches
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < duplicateIds.length; i += batchSize) {
      const batch = duplicateIds.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from("questions")
        .delete()
        .in("id", batch);
      
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        throw deleteError;
      }
      
      totalDeleted += batch.length;
    }

    console.log(`Successfully removed ${totalDeleted} duplicate questions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        duplicatesRemoved: totalDeleted,
        message: `Removed ${totalDeleted} duplicate questions` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in deduplicate-questions:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        duplicatesRemoved: 0 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
