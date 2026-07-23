import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, context, prompt } = await req.json();
    
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

    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'subject_description':
        systemPrompt = 'You are an expert education content writer specializing in creating engaging subject descriptions for online learning platforms.';
        userPrompt = prompt || `Create a compelling, informative description for the subject "${context.subjectName}"${context.categoryName ? ` in the ${context.categoryName} category` : ''}.

The description should:
- Be between 400-500 characters (aim for 450-500 to maximize content)
- Be 3-4 well-crafted sentences
- Highlight why students should study this subject
- Mention key topics and concepts covered
- Emphasize practical applications and benefits
- Be engaging and motivational for students
- Use clear, accessible language

CRITICAL: The description must be at least 400 characters and MAXIMUM 500 characters. Aim for 450-500 characters to provide comprehensive content.
Return ONLY the description text, without any headings or formatting.`;
        break;

      case 'description':
        systemPrompt = 'You are an expert course description writer. Create engaging, clear, and compelling course descriptions.';
        userPrompt = prompt || `Write a ${context.shortDescription ? 'detailed' : 'short'} description for a course named "${context.courseName}". ${context.shortDescription ? `The short description is: ${context.shortDescription}` : ''} Make it engaging and highlight the key benefits.`;
        break;
      
      case 'what_you_learn':
        systemPrompt = 'You are an expert at defining learning outcomes. List specific, actionable learning points.';
        userPrompt = prompt || `List 6-8 specific things students will learn in the course "${context.courseName}". ${context.shortDescription ? `Course description: ${context.shortDescription}` : ''} Format as a JSON array of strings. Each point should start with an action verb and be concrete.`;
        break;
      
      case 'course_includes':
        systemPrompt = 'You are an expert at describing course features and inclusions.';
        userPrompt = prompt || `List 5-7 features/inclusions for the course "${context.courseName}". ${context.shortDescription ? `Course description: ${context.shortDescription}` : ''} Format as a JSON array of objects with "icon" (lucide-react icon name like Video, Book, Clock, Award, Users, Download, MessageSquare) and "text" (feature description) properties.`;
        break;
      
      case 'faq_answer':
        systemPrompt = 'You are a helpful assistant answering frequently asked questions about courses.';
        userPrompt = prompt || `Answer this FAQ for the course "${context.courseName}": ${context.question}. ${context.shortDescription ? `Course description: ${context.shortDescription}` : ''} Keep it concise and helpful.`;
        break;
    }

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
      console.error('AI API Error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    let content = aiResponse.choices[0].message.content;

    // Parse JSON responses for structured data
    if (type === 'what_you_learn' || type === 'course_includes') {
      try {
        const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) {
          content = JSON.parse(jsonMatch[1]);
        } else {
          content = JSON.parse(content);
        }
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        if (type === 'what_you_learn') {
          content = content.split('\n').filter((line: string) => line.trim().match(/^[\d\-\*]/)).map((line: string) => line.replace(/^[\d\-\*\.\)]\s*/, '').trim());
        }
      }
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
