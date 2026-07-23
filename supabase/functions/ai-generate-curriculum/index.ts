import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subjectName, categoryName, numberOfChapters = 10 } = await req.json();
    
    if (!subjectName) {
      return new Response(
        JSON.stringify({ error: "Subject name is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert curriculum designer. Generate a comprehensive chapter structure for educational content.

Your output MUST be valid JSON following this exact structure:
{
  "chapters": [
    {
      "chapter_number": 1,
      "title": "Chapter Title",
      "description": "Brief description",
      "topics": [
        {
          "topic_number": 1,
          "title": "Topic Title",
          "estimated_duration_minutes": 60,
          "content_markdown": "Brief content overview",
          "subtopics": [
            {
              "title": "Subtopic Title",
              "description": "Brief description",
              "estimated_duration_minutes": 30,
              "sequence_order": 1
            }
          ]
        }
      ]
    }
  ]
}

Requirements:
- Generate ${numberOfChapters} chapters
- Each chapter should have 3-5 topics
- Each topic should have 2-4 subtopics
- Follow standard curriculum progression (basic to advanced)
- Include appropriate duration estimates
- Make content academically accurate`;

    const userPrompt = `Generate a comprehensive curriculum structure for "${subjectName}"${categoryName ? ` in the context of ${categoryName}` : ''}.

Follow standard educational curriculum guidelines and ensure logical progression from foundational to advanced concepts.`;

    console.log('Generating curriculum for:', subjectName);

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
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_curriculum',
              description: 'Generate structured curriculum with chapters, topics, and subtopics',
              parameters: {
                type: 'object',
                properties: {
                  chapters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        chapter_number: { type: 'integer' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        topics: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              topic_number: { type: 'integer' },
                              title: { type: 'string' },
                              estimated_duration_minutes: { type: 'integer' },
                              content_markdown: { type: 'string' },
                              subtopics: {
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    estimated_duration_minutes: { type: 'integer' },
                                    sequence_order: { type: 'integer' }
                                  },
                                  required: ['title', 'description', 'estimated_duration_minutes', 'sequence_order'],
                                  additionalProperties: false
                                }
                              }
                            },
                            required: ['topic_number', 'title', 'estimated_duration_minutes'],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ['chapter_number', 'title', 'description', 'topics'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['chapters'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_curriculum' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Invalid or unauthorized API key. Please check your API key in Admin Settings.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error('No curriculum data generated');
    }

    const curriculum = JSON.parse(toolCall.function.arguments);
    
    console.log(`Generated ${curriculum.chapters?.length || 0} chapters`);

    return new Response(
      JSON.stringify({
        success: true,
        curriculum: curriculum.chapters || [],
        metadata: {
          subject: subjectName,
          category: categoryName,
          generatedAt: new Date().toISOString(),
          chaptersCount: curriculum.chapters?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-generate-curriculum:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate curriculum',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
