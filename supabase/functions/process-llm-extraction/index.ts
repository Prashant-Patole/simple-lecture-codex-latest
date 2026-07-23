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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let jobId: string | null = null;
  let documentId: string | null = null;

  try {
    const body = await req.json();
    jobId = body.jobId;
    documentId = body.documentId;

    if (!jobId || !documentId) {
      throw new Error('jobId and documentId are required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get AI API configuration from database
    const { data: aiConfig } = await supabaseAdmin
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
      console.log('Using custom Google AI API with model:', model);
    } else if (config?.enabled && config?.provider === 'openai' && config?.openai_api_key) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = config.openai_api_key;
      model = config.default_model || "gpt-4o-mini";
      console.log('Using custom OpenAI API with model:', model);
    } else {
      console.error('No valid AI API configuration found');
      throw new Error('AI API not configured. Please go to Admin → Settings → AI Functions API Key Settings to add your API key.');
    }

    // Helper functions
    const logJobProgress = async (level: string, message: string, details?: any) => {
      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: level,
        message,
        details: details || null
      });
    };

    const updateJobProgress = async (percentage: number, step: string, data?: any) => {
      const updateData: any = {
        progress_percentage: percentage,
        current_step: step
      };
      if (data) {
        updateData.result_data = data;
      }
      await supabaseAdmin
        .from('document_processing_jobs')
        .update(updateData)
        .eq('id', jobId);
    };

    await logJobProgress('info', 'Starting LLM question extraction');

    // Fetch document with MMD and JSON
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('uploaded_question_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // Use MMD if available (better LaTeX preservation), fallback to markdown
    const documentContent = document.mathpix_mmd || document.mathpix_markdown;
    const documentJson = document.mathpix_json_output;

    if (!documentContent) {
      throw new Error('Document has no processed content. Please process document first.');
    }

    await logJobProgress('info', 'Fetched document content', {
      has_mmd: !!document.mathpix_mmd,
      has_json: !!document.mathpix_json_output,
      content_length: documentContent?.length || 0
    });

    await updateJobProgress(20, 'Document fetched, preparing for extraction');

    const systemPrompt = `You are an expert at parsing educational questions from JEE/NEET examination papers processed by Mathpix OCR.

**Input Format:**
1. Mathpix Markdown (MMD) - preserves LaTeX formulas and structure
2. Mathpix JSON - contains structured elements

**Your Task:**
Extract each question as a separate object with:
- question_text: Full question with LaTeX formulas preserved (e.g., \\( x^2 + 5x + 6 = 0 \\))
- question_format: "single_choice" (for MCQs), "multiple_choice", "true_false", "fill_blank", "short_answer"
- options: { "A": "...", "B": "...", "C": "...", "D": "..." } for MCQs (use null if not MCQ)
- correct_answer: The correct option letter(s) or answer text
- explanation: Solution/explanation if present (use null if not available)
- difficulty: Auto-detect based on complexity:
  * "Low" - Basic recall, simple arithmetic, direct formulas
  * "Medium" - Single-concept application, straightforward problem-solving
  * "Intermediate" - Multi-step reasoning, 2-3 concepts combined
  * "Advanced" - Complex analysis, advanced concepts, multi-layered reasoning
- difficulty_reasoning: Brief explanation (1 sentence) why you chose this difficulty

**Question Boundary Detection:**
- Look for question numbers: "Q1", "Q2", "1.", "2.", etc.
- Each MCQ typically has 4 options (A, B, C, D or 1, 2, 3, 4)
- Questions may span multiple lines
- Options may contain LaTeX formulas

**LaTeX Preservation:**
- Keep all LaTeX exactly as written: \\( ... \\) for inline, \\[ ... \\] for display
- Common symbols: \\sqrt{}, \\frac{}{}, \\int, \\sum, \\alpha, \\beta, etc.
- DO NOT modify or "fix" LaTeX unless it's clearly broken

**OCR Quality Assessment:**
Flag potential issues:
- Malformed LaTeX (unmatched braces, broken syntax)
- Garbled text or unclear question structure
- Missing options or incomplete data
- Unusual formatting

**Output Format:**
Return a valid JSON object with this structure:
{
  "questions": [
    {
      "question_text": "...",
      "question_format": "single_choice",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct_answer": "C",
      "explanation": "..." or null,
      "difficulty": "Medium",
      "difficulty_reasoning": "Requires understanding of quadratic formula application",
      "ocr_quality_notes": "Clean extraction" or "Minor LaTeX formatting issues detected"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no explanations, just the JSON object.`;

    const userPrompt = `Document: ${document.file_name}

**Mathpix Markdown (MMD):**
\`\`\`
${documentContent}
\`\`\`

${documentJson ? `**Mathpix JSON Structure:**
\`\`\`json
${JSON.stringify(documentJson, null, 2)}
\`\`\`
` : ''}

Extract all questions from this document. Return valid JSON only.`;

    await updateJobProgress(40, 'Calling AI to extract questions');
    await logJobProgress('info', 'Invoking AI extraction', {
      prompt_length: userPrompt.length
    });

    const aiResponse = await fetch(apiUrl, {
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
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      await logJobProgress('error', 'AI extraction failed', {
        status: aiResponse.status,
        error: errorText
      });
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 401 || aiResponse.status === 403) {
        throw new Error('Invalid or unauthorized API key. Please check your API key in Admin Settings.');
      }
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const llmResponse = aiData.choices[0]?.message?.content;

    if (!llmResponse) {
      throw new Error('No response from AI');
    }

    await logJobProgress('info', 'Received AI response', {
      response_length: llmResponse.length
    });

    await updateJobProgress(70, 'Parsing AI response');

    // Parse JSON response (handle markdown code blocks if present)
    let extractedData;
    try {
      let jsonText = llmResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
      }
      
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      await logJobProgress('error', 'Failed to parse AI response', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        response_preview: llmResponse.substring(0, 500)
      });
      throw new Error('Failed to parse AI response as JSON');
    }

    const questions = extractedData.questions || [];

    if (!Array.isArray(questions)) {
      throw new Error('Invalid response format: questions is not an array');
    }

    await logJobProgress('info', `Extracted ${questions.length} questions`);
    await updateJobProgress(80, `Saving ${questions.length} questions to database`);

    // Insert questions into pending table
    let insertedCount = 0;
    const difficultyDistribution: any = { Low: 0, Medium: 0, Intermediate: 0, Advanced: 0 };

    const questionRecords = questions.map((q: any) => {
      if (q.difficulty) {
        difficultyDistribution[q.difficulty]++;
      }
      return {
        document_id: documentId,
        category_id: document.category_id,
        subject_id: document.subject_id,
        chapter_id: document.chapter_id,
        topic_id: document.topic_id,
        subtopic_id: document.subtopic_id,
        question_text: q.question_text,
        question_format: q.question_format || 'single_choice',
        question_type: q.question_type || 'objective',
        difficulty: q.difficulty || 'Medium',
        marks: q.marks || 1,
        options: q.options || null,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        llm_suggested_difficulty: q.difficulty || 'Medium',
        llm_difficulty_reasoning: q.difficulty_reasoning || null,
        contains_formula: (q.question_text || '').includes('\\(') || (q.question_text || '').includes('\\[')
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from('parsed_questions_pending')
      .insert(questionRecords);

    if (insertError) {
      await logJobProgress('error', 'Failed to insert questions', {
        error: insertError.message
      });
      throw insertError;
    }

    insertedCount = questionRecords.length;

    // Also insert into main questions table for immediate student access
    const questionBankRecords = questions.map((q: any) => ({
      topic_id: document.topic_id,
      chapter_id: document.chapter_id,
      subtopic_id: document.subtopic_id,
      question_text: q.question_text,
      question_format: q.question_format || 'single_choice',
      question_type: q.question_type || 'objective',
      difficulty: q.difficulty || 'Medium',
      marks: q.marks || 1,
      options: q.options || null,
      correct_answer: q.correct_answer,
      explanation: q.explanation || null,
      contains_formula: (q.question_text || '').includes('\\(') || (q.question_text || '').includes('\\['),
      source_document_id: documentId,
      source_document_purpose: document.document_purpose || 'general',
      is_ai_generated: true,
      is_verified: false
    }));

    const { error: qbInsertError } = await supabaseAdmin
      .from('questions')
      .insert(questionBankRecords);

    if (qbInsertError) {
      await logJobProgress('warn', 'Failed to insert into questions table (students will see after approval)', {
        error: qbInsertError.message
      });
    } else {
      await logJobProgress('info', `Also inserted ${questionBankRecords.length} questions into question bank for immediate student access`);
    }

    await updateJobProgress(95, 'Finalizing extraction');

    // Mark job as completed
    await supabaseAdmin
      .from('document_processing_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        current_step: 'Extraction complete',
        completed_at: new Date().toISOString(),
        questions_extracted: insertedCount,
        result_data: {
          total_questions: insertedCount,
          difficulty_distribution: difficultyDistribution
        }
      })
      .eq('id', jobId);

    await logJobProgress('info', `Extraction completed: ${insertedCount} questions saved`);

    console.log(`Question extraction completed: ${insertedCount} questions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        questionsExtracted: insertedCount,
        difficultyDistribution 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Worker extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (jobId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          error_details: {
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'Error'
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: 'error',
        message: `Extraction failed: ${errorMessage}`,
        details: { 
          error_type: error instanceof Error ? error.name : 'Error',
          stack: error instanceof Error ? error.stack : undefined 
        }
      });
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
