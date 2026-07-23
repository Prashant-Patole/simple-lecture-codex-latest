import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic_id } = await req.json();
    
    if (!topic_id) {
      return new Response(
        JSON.stringify({ error: 'topic_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Edge function called with topic_id:', topic_id);
    console.log('SUPABASE_URL configured:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY configured:', !!supabaseKey);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error', details: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch topic info (simple query first)
    console.log('Fetching topic from subject_topics...');
    const { data: topic, error: topicError } = await supabase
      .from('subject_topics')
      .select('id, title, chapter_id, content_markdown, notes_markdown')
      .eq('id', topic_id)
      .maybeSingle();

    if (topicError) {
      console.error('Error fetching topic:', JSON.stringify(topicError));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch topic', 
          details: { code: topicError.code, message: topicError.message }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!topic) {
      console.error('Topic not found with id:', topic_id);
      return new Response(
        JSON.stringify({ error: 'Topic not found', topic_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch chapter info
    console.log('Fetching chapter:', topic.chapter_id);
    let chapter = null;
    let subject = null;
    
    if (topic.chapter_id) {
      const { data: chapterData, error: chapterError } = await supabase
        .from('subject_chapters')
        .select('id, title, subject_id')
        .eq('id', topic.chapter_id)
        .maybeSingle();
      
      if (chapterError) {
        console.warn('Error fetching chapter:', chapterError.message);
      } else {
        chapter = chapterData;
        
        // 3. Fetch subject info
        if (chapter?.subject_id) {
          const { data: subjectData, error: subjectError } = await supabase
            .from('popular_subjects')
            .select('id, name')
            .eq('id', chapter.subject_id)
            .maybeSingle();
          
          if (subjectError) {
            console.warn('Error fetching subject:', subjectError.message);
          } else {
            subject = subjectData;
          }
        }
      }
    }

    console.log('Fetched topic:', topic?.title);

    // 2. Fetch documentation for this topic
    const { data: docs, error: docsError } = await supabase
      .from('ai_assistant_documents')
      .select('full_content, content_preview, display_name')
      .eq('topic_id', topic_id)
      .eq('status', 'active');

    if (docsError) {
      console.error('Error fetching documents:', docsError);
    }

    console.log(`Found ${docs?.length || 0} documents for topic`);

    // 3. Build context from documents
    let documentContext = '';
    if (docs && docs.length > 0) {
      documentContext = docs.map(d => {
        if (d.full_content) {
          return typeof d.full_content === 'string' 
            ? d.full_content 
            : JSON.stringify(d.full_content);
        }
        return d.content_preview || '';
      }).filter(Boolean).join('\n\n');
    }

    // Add topic content as additional context
    if (topic?.content_markdown) {
      documentContext = topic.content_markdown + '\n\n' + documentContext;
    }
    if (topic?.notes_markdown) {
      documentContext = topic.notes_markdown + '\n\n' + documentContext;
    }

    // Build topic context (using already fetched chapter and subject)
    const topicContext = `
Topic: ${topic?.title || 'Unknown Topic'}
Chapter: ${chapter?.title || 'Unknown Chapter'}
Subject: ${subject?.name || 'Unknown Subject'}
    `.trim();

    // Get AI configuration from database
    const { data: aiConfig } = await supabase
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_config')
      .maybeSingle();

    const config = aiConfig?.setting_value as any;

    // 4. Generate 10 MCQs using AI with tool calling for structured output
    const systemPrompt = `You are an expert educational content creator. Generate exactly 10 high-quality multiple choice questions (MCQs) based on the provided topic and documentation.

IMPORTANT RULES:
1. Generate EXACTLY 10 questions - no more, no less
2. Each question must have exactly 4 options labeled A, B, C, D
3. Only ONE option should be correct
4. Questions should test understanding, not just memorization
5. Include a mix of difficulty levels (easy, medium, hard)
6. Provide a brief explanation for each correct answer`;

    const userPrompt = `Generate 10 MCQ questions for the following topic:

${topicContext}

${documentContext ? `\nReference Documentation:\n${documentContext.substring(0, 15000)}` : '\nNo documentation available - generate questions based on the topic name and general knowledge of the subject.'}`;

    console.log('Calling AI to generate questions with tool calling...');

    // Determine API based on config
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
        JSON.stringify({ 
          error: "AI API not configured. Please go to Admin → Settings → AI Functions API Key Settings to add your API key." 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_questions",
              description: "Submit the generated MCQ questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "number" },
                        question: { type: "string" },
                        options: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", enum: ["A", "B", "C", "D"] },
                              text: { type: "string" }
                            },
                            required: ["id", "text"],
                            additionalProperties: false
                          }
                        },
                        correctAnswer: { type: "string", enum: ["A", "B", "C", "D"] },
                        explanation: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                      },
                      required: ["id", "question", "options", "correctAnswer", "explanation", "difficulty"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["questions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_questions" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    
    // Extract questions from tool call
    let questions;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== 'submit_questions') {
        console.error('No valid tool call in response:', JSON.stringify(aiData.choices?.[0]?.message));
        throw new Error('AI did not return questions via tool call');
      }
      
      const args = JSON.parse(toolCall.function.arguments);
      questions = args.questions;
      
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format');
      }
      
      // Ensure we have at most 10 questions
      if (questions.length > 10) {
        questions = questions.slice(0, 10);
      }
      
      console.log(`Successfully parsed ${questions.length} questions`);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Full AI response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: 'Failed to parse generated questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        questions,
        topic: {
          id: topic?.id,
          title: topic?.title,
          chapter: chapter?.title,
          subject: subject?.name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-generate-dpp:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
