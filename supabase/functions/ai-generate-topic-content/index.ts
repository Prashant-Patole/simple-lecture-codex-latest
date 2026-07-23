import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      topicTitle, 
      topicDescription, 
      chapterTitle, 
      chapterDescription,
      subjectName,
      categoryName,
      estimatedDurationMinutes 
    } = await req.json();

    console.log('Generating topic content for:', topicTitle);

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
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert educational content creator specializing in creating comprehensive, student-friendly learning materials. Your goal is to generate detailed, accurate, and engaging educational content that helps students understand complex topics effectively.`;

    const userPrompt = `Generate comprehensive learning content for the following topic:

**Topic**: ${topicTitle}
**Topic Description**: ${topicDescription || 'Not provided'}
**Chapter**: ${chapterTitle}
**Chapter Description**: ${chapterDescription || 'Not provided'}
**Subject**: ${subjectName}
**Category**: ${categoryName}
**Estimated Duration**: ${estimatedDurationMinutes} minutes

Please generate the following sections:

## 1. DETAILED CONTENT (Markdown format)
- Introduction to the topic (what it is and why it matters)
- Key concepts and definitions (clear, student-friendly explanations)
- Formulas and equations (use LaTeX format with $$...$$ for display math)
- Visual descriptions (describe what diagrams or charts would be helpful)
- Step-by-step explanations of processes or procedures
- Important notes, tips, and common misconceptions
- Summary of key takeaways

## 2. EXAMPLES (3-5 worked examples)
Each example should include:
- A clear problem statement
- Detailed step-by-step solution
- Final answer with explanation
- Difficulty level (easy/medium/hard)
- Real-world context where applicable

## 3. PRACTICE QUESTIONS (8-10 questions)
Mix of:
- 5-6 Multiple Choice Questions (MCQs) with 4 options each
- 2-3 Descriptive questions requiring detailed answers
Each question should include:
- Clear question text
- Options (for MCQs)
- Correct answer
- Detailed explanation of why the answer is correct
- Difficulty level (easy/medium/hard)

Format your response as a valid JSON object with this exact structure:
{
  "content": "# Topic Title\\n\\nDetailed markdown content here...",
  "examples": [
    {
      "title": "Example 1: Basic Application",
      "problem": "Problem statement here",
      "solution": "Step-by-step solution here",
      "difficulty": "easy"
    }
  ],
  "practiceQuestions": [
    {
      "type": "mcq",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Detailed explanation",
      "difficulty": "medium"
    },
    {
      "type": "descriptive",
      "question": "Question text",
      "correctAnswer": "Expected answer key points",
      "explanation": "Detailed explanation",
      "difficulty": "hard"
    }
  ]
}

Ensure all mathematical formulas use proper LaTeX notation and all content is accurate, well-structured, and pedagogically sound.`;

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Invalid or unauthorized API key. Please check your API key in Admin Settings.' }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated from AI');
    }

    // Parse the JSON response
    let parsedContent;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse AI-generated content');
    }

    // Validate the response structure
    if (!parsedContent.content || !parsedContent.examples || !parsedContent.practiceQuestions) {
      throw new Error('Invalid content structure from AI');
    }

    console.log('Successfully generated topic content');

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-generate-topic-content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
