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
    const body = await req.json();
    const {
      // Backward compat
      documentId,
      // New explicit ids
      sourceDocumentId: sourceDocumentIdRaw,
      dppDocumentId: dppDocumentIdRaw,
      pageNumber,
      pageContent,
      subjectId,
      chapterId,
      topicId,
    } = body ?? {};

    const sourceDocumentId = sourceDocumentIdRaw ?? documentId;
    const dppDocumentId = dppDocumentIdRaw ?? documentId;

    if (!pageNumber || !pageContent) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: pageNumber, pageContent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sourceDocumentId && !dppDocumentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: provide sourceDocumentId and/or dppDocumentId (or legacy documentId)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing page ${pageNumber} | dppDocumentId=${dppDocumentId ?? 'n/a'} | sourceDocumentId=${sourceDocumentId ?? 'n/a'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract questions from this page using AI
    const questions = await extractQuestionsFromPage(supabase, pageContent, pageNumber);
    console.log(`Extracted ${questions.length} questions from page ${pageNumber}`);

    // Insert questions to database (main questions table with dpp tagging)
    if (questions.length > 0) {
      if (!sourceDocumentId) {
        return new Response(
          JSON.stringify({ error: 'sourceDocumentId is required to insert into question bank' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate FK early to avoid 500s with cryptic FK errors
      const { data: sourceDoc, error: sourceDocError } = await supabase
        .from('uploaded_question_documents')
        .select('id')
        .eq('id', sourceDocumentId)
        .maybeSingle();

      if (sourceDocError) {
        console.error('Error validating source document:', sourceDocError);
        throw new Error(`Failed to validate source document: ${sourceDocError.message}`);
      }

      if (!sourceDoc) {
        return new Response(
          JSON.stringify({
            error: 'Invalid sourceDocumentId (must reference uploaded_question_documents.id)',
            details: `Key (source_document_id)=(${sourceDocumentId}) is not present in uploaded_question_documents`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const questionsToInsert = questions.map((q: any) => {
        // Convert options from array format to object format { a: 'text', b: 'text', ... }
        const optionsObj: Record<string, string> = {};
        if (Array.isArray(q.options)) {
          q.options.forEach((opt: any) => {
            if (opt.id && opt.text) {
              optionsObj[opt.id.toLowerCase()] = opt.text;
            }
          });
        } else if (q.options && typeof q.options === 'object') {
          Object.assign(optionsObj, q.options);
        }

        return {
          topic_id: topicId || null,
          chapter_id: chapterId || null,
          question_text: q.question_text,
          question_type: 'mcq',
          question_format: 'single_choice',
          options: optionsObj,
          correct_answer: '',
          difficulty: mapDifficultyToDb(q.difficulty),
          explanation: q.explanation || null,
          source_document_purpose: 'dpp',
          source_document_id: sourceDocumentId,
          is_ai_generated: true,
          is_verified: false,
        };
      });

      const { error: insertError } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (insertError) {
        console.error('Error inserting questions:', insertError);
        throw new Error(`Failed to insert questions: ${insertError.message}`);
      }
    }

    // Update document progress
    if (dppDocumentId) {
      const { error: updateError } = await supabase
        .from('dpp_documents')
        .update({ current_page: pageNumber })
        .eq('id', dppDocumentId);

      if (updateError) {
        console.error('Error updating document progress:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pageNumber, 
        questionsFound: questions.length,
        sourceDocumentId,
        dppDocumentId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing page:', error);
    const message = error instanceof Error ? error.message : 'Failed to process page';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractQuestionsFromPage(supabase: any, pageContent: string, pageNumber: number): Promise<any[]> {
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
    throw new Error('AI API not configured. Please configure your API key in Admin Settings.');
  }

  const systemPrompt = `You are an expert at extracting MCQ questions from educational documents.
Extract all multiple choice questions from this page content.

IMPORTANT - Option Format Recognition:
The document uses markdown bullet format for options like:
- (a) Option text
- (b) Option text
OR numbered format like:
(a) Option text
(b) Option text
OR simple format like:
a) Option text
b) Option text

Rules:
1. Extract question_number, question_text, and ALL options (a, b, c, d)
2. Options are often formatted as "- (a) text" or "(a) text" - extract the text AFTER the letter identifier
3. DO NOT include the "(a)" or "a)" prefix in the option text - just the actual answer text
4. DO NOT include correct_answer - answers will be extracted separately
5. Set difficulty to "easy", "medium", or "hard" based on complexity
6. Preserve all mathematical notation (LaTeX/KaTeX format)
7. If options appear to be empty or just contain letters/numbers, SKIP that question
8. Include explanation if available in the content

Example Input:
1. The solubility of a gas in water depends on
- (a) Nature of the gas
- (b) Temperature  
- (c) Pressure of the gas
- (d) All of the above

Expected Output:
{
  "question_number": 1,
  "question_text": "The solubility of a gas in water depends on",
  "options": {
    "a": "Nature of the gas",
    "b": "Temperature",
    "c": "Pressure of the gas", 
    "d": "All of the above"
  }
}`;

  const userPrompt = `Extract all MCQ questions from this page content (Page ${pageNumber}):

${pageContent}`;

  const extractionTool = {
    type: "function",
    function: {
      name: "extract_questions",
      description: "Extract MCQ questions from the page",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_number: { type: "number", description: "Question number" },
                question_text: { type: "string", description: "Full question text with all mathematical notation preserved" },
                options: {
                  type: "object",
                  properties: {
                    a: { type: "string", description: "Option A text (without the 'a)' prefix)" },
                    b: { type: "string", description: "Option B text (without the 'b)' prefix)" },
                    c: { type: "string", description: "Option C text (without the 'c)' prefix)" },
                    d: { type: "string", description: "Option D text (without the 'd)' prefix)" }
                  },
                  required: ["a", "b", "c", "d"]
                },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                explanation: { type: "string", description: "Explanation if available" }
              },
              required: ["question_number", "question_text", "options"]
            }
          }
        },
        required: ["questions"]
      }
    }
  };

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
      tools: [extractionTool],
      tool_choice: { type: "function", function: { name: "extract_questions" } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Parse tool call response
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const questions = parsed.questions || [];
      
      // Filter out invalid questions with empty/garbage options
      const validQuestions = questions.filter((q: any) => {
        if (!q.options || typeof q.options !== 'object') return false;
        
        const optionTexts = Object.values(q.options);
        // Check if at least 2 options have meaningful text (more than 1 char)
        const validOptionCount = optionTexts.filter((text: any) => 
          typeof text === 'string' && text.trim().length > 1
        ).length;
        
        if (validOptionCount < 2) {
          console.log(`Skipping question ${q.question_number} - insufficient valid options`);
          return false;
        }
        
        // Check for placeholder/error text in question
        const badPatterns = ['i am sorry', 'cannot locate', 'not present in the document', 'no questions'];
        const questionText = String(q.question_text || '').toLowerCase();
        if (badPatterns.some(p => questionText.includes(p))) {
          console.log(`Skipping question ${q.question_number} - contains error text`);
          return false;
        }
        
        return true;
      });
      
      console.log(`Validated ${validQuestions.length}/${questions.length} questions`);
      return validQuestions;
    } catch (e) {
      console.error('Error parsing tool response:', e);
      return [];
    }
  }

  return [];
}

function mapDifficultyToDb(value: unknown): 'Low' | 'Medium' | 'Intermediate' | 'Advanced' {
  const v = String(value ?? '').trim();
  // If the model already returns DB values, keep them
  if (v === 'Low' || v === 'Medium' || v === 'Intermediate' || v === 'Advanced') return v;

  const lc = v.toLowerCase();
  if (lc === 'low') return 'Low';
  if (lc === 'medium') return 'Medium';
  if (lc === 'intermediate') return 'Intermediate';
  if (lc === 'advanced') return 'Advanced';
  if (lc === 'easy') return 'Low';
  if (lc === 'hard') return 'Advanced';
  return 'Medium';
}
