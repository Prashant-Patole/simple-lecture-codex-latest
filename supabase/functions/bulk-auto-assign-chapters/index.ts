import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
        JSON.stringify({ error: 'AI API not configured. Please configure your API key in Admin Settings.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch document details
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_question_documents')
      .select(`
        *,
        categories(name),
        popular_subjects(name),
        subject_chapters(id, title),
        subject_topics(id, title, chapter_id)
      `)
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Fetch all unassigned questions for this document
    const { data: questions, error: questionsError } = await supabaseClient
      .from('parsed_questions_pending')
      .select('*')
      .eq('document_id', documentId)
      .or('chapter_id.is.null,topic_id.is.null');

    if (questionsError) throw questionsError;

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unassigned questions found', assignedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all chapters, topics, subtopics for this subject
    const { data: chapters } = await supabaseClient
      .from('subject_chapters')
      .select('id, title, description')
      .eq('subject_id', document.subject_id);

    const { data: topics } = await supabaseClient
      .from('subject_topics')
      .select('id, title, description, chapter_id')
      .eq('subject_id', document.subject_id);

    const { data: subtopics } = await supabaseClient
      .from('subtopics')
      .select('id, title, description, topic_id')
      .in('topic_id', topics?.map(t => t.id) || []);

    let assignedCount = 0;
    const results = [];

    // Process each question with AI suggestions
    for (const question of questions) {
      try {
        const systemPrompt = `You are an expert educational content classifier. Analyze the question and suggest the most appropriate chapter, topic, and subtopic. Return a JSON object.`;

        const userPrompt = `Question: ${question.question_text}

Subject: ${document.popular_subjects?.name}
Category: ${document.categories?.name}

Available Chapters:
${JSON.stringify(chapters || [], null, 2)}

Available Topics:
${JSON.stringify(topics || [], null, 2)}

Available Subtopics:
${JSON.stringify(subtopics || [], null, 2)}

Suggest the best match. Return JSON with: {"chapterId": "uuid", "topicId": "uuid", "subtopicId": "uuid or null", "confidence": 0.0-1.0, "reasoning": "text"}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const suggestion = JSON.parse(data.choices[0].message.content);

          // Update question with AI suggestion
          const { error: updateError } = await supabaseClient
            .from('parsed_questions_pending')
            .update({
              chapter_id: suggestion.chapterId,
              topic_id: suggestion.topicId,
              subtopic_id: suggestion.subtopicId || null,
              instructor_comments: `AI Auto-assigned (confidence: ${suggestion.confidence}): ${suggestion.reasoning}`
            })
            .eq('id', question.id);

          if (!updateError) {
            assignedCount++;
            results.push({
              questionId: question.id,
              success: true,
              confidence: suggestion.confidence
            });
          }
        }
      } catch (error) {
        console.error(`Error processing question ${question.id}:`, error);
        results.push({
          questionId: question.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({
        message: `Auto-assigned ${assignedCount} out of ${questions.length} questions`,
        assignedCount,
        totalQuestions: questions.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-auto-assign-chapters:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
