import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATALAB_API_KEY = Deno.env.get('DATALAB_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { documentId, action, parsedContent } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get document info
    const { data: document, error: docError } = await supabase
      .from('dpp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabase
      .from('dpp_documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', documentId);

    console.log(`[DPP Extraction] Starting extraction for document ${documentId}`);

    // Use parsed content if provided (from client-side parsing), otherwise parse here
    let questionsMmd = parsedContent?.questionsMmd || document.questions_mmd;
    let solutionsMmd = parsedContent?.solutionsMmd || document.solutions_mmd;

    // If no parsed content provided, parse with Datalab
    if (!questionsMmd && document.questions_file_url) {
      console.log('[DPP Extraction] Parsing questions PDF with Datalab...');
      questionsMmd = await parsePdfWithDatalab(document.questions_file_url);
      await supabase
        .from('dpp_documents')
        .update({ questions_mmd: questionsMmd })
        .eq('id', documentId);
    }

    if (!solutionsMmd && document.solutions_file_url) {
      console.log('[DPP Extraction] Parsing solutions PDF with Datalab...');
      solutionsMmd = await parsePdfWithDatalab(document.solutions_file_url);
      await supabase
        .from('dpp_documents')
        .update({ solutions_mmd: solutionsMmd })
        .eq('id', documentId);
    }

    if (!questionsMmd) {
      throw new Error('No questions content available for extraction');
    }

    // Delete existing questions for this document before inserting (fresh re-run)
    await supabase
      .from('questions')
      .delete()
      .eq('source_document_id', documentId);

    // Extract + insert questions with AI in a streaming manner (lower memory)
    console.log('[DPP Extraction] Extracting + inserting questions with AI...');
    const { questionsCount, previewQuestions } = await extractAndInsertQuestionsWithAI({
      supabase,
      documentId,
      subjectId: document.subject_id,
      chapterId: document.chapter_id,
      topicId: document.topic_id,
      questionsMmd,
      solutionsMmd: solutionsMmd || '',
    });

    // Update document status to completed
    await supabase
      .from('dpp_documents')
      .update({
        status: 'completed',
        questions_count: questionsCount,
        error_message: null,
      })
      .eq('id', documentId);

    console.log(`[DPP Extraction] Successfully extracted ${questionsCount} questions`);

    // IMPORTANT: return only a preview list to keep response size small
    return new Response(
      JSON.stringify({
        success: true,
        questionsCount,
        questions: previewQuestions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DPP Extraction] Error:', error);
    
    // Try to update document status to failed
    try {
      const { documentId } = await req.clone().json();
      if (documentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('dpp_documents')
          .update({ 
            status: 'failed', 
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', documentId);
      }
    } catch (e) {
      console.error('[DPP Extraction] Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Extraction failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function parsePdfWithDatalab(pdfUrl: string): Promise<string> {
  console.log('[DPP Extraction] Sending PDF URL to Datalab:', pdfUrl);
  
  // Use FormData format as expected by Datalab API
  const formData = new FormData();
  formData.append('file_url', pdfUrl);
  formData.append('output_format', 'markdown');
  formData.append('force_ocr', 'false');
  formData.append('paginate_output', 'true');

  const response = await fetch('https://www.datalab.to/api/v1/marker', {
    method: 'POST',
    headers: {
      'X-API-Key': DATALAB_API_KEY!,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[DPP Extraction] Datalab API error response:', errorBody);
    throw new Error(`Datalab API error: ${response.status} - ${errorBody}`);
  }

  const result = await response.json();
  
  // Poll for completion
  const requestId = result.request_id;
  let markdown = '';
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max

  console.log(`[DPP Extraction] Got request ID: ${requestId}, polling for completion...`);

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
    
    const statusResponse = await fetch(`https://www.datalab.to/api/v1/marker/${requestId}`, {
      headers: { 'X-API-Key': DATALAB_API_KEY! },
    });
    
    const statusResult = await statusResponse.json();
    console.log(`[DPP Extraction] Poll attempt ${attempts + 1}: status = ${statusResult.status}`);
    
    if (statusResult.status === 'complete') {
      markdown = statusResult.markdown || '';
      break;
    } else if (statusResult.status === 'failed') {
      throw new Error('PDF parsing failed: ' + (statusResult.error || 'Unknown error'));
    }
    
    attempts++;
  }

  if (!markdown) {
    throw new Error('PDF parsing timed out');
  }

  console.log(`[DPP Extraction] PDF parsed successfully, got ${markdown.length} chars of markdown`);
  return markdown;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function extractAndInsertQuestionsWithAI(params: {
  // NOTE: keep this untyped to avoid Deno/Supabase generic type incompatibilities in Edge Functions
  supabase: any;
  documentId: string;
  subjectId: string;
  chapterId: string | null;
  topicId: string | null;
  questionsMmd: string;
  solutionsMmd: string;
}): Promise<{ questionsCount: number; previewQuestions: any[] }> {
  const {
    supabase,
    documentId,
    subjectId,
    chapterId,
    topicId,
    questionsMmd,
    solutionsMmd,
  } = params;

  const previewQuestions: any[] = [];
  const previewLimit = 20;
  const seenQuestionNumbers = new Set<number>();

  // Chunking: keep memory low by NOT building an intermediate "segments" array
  const maxChunkChars = 32000;
  const totalApproxChunks = Math.max(1, Math.ceil(questionsMmd.length / maxChunkChars));

  console.log(
    `[DPP Extraction] Chunking questions markdown: ${questionsMmd.length} chars (~${totalApproxChunks} chunks)`
  );

  let totalInserted = 0;
  let chunkIndex = 0;

  for (const chunk of iterateTextChunks(questionsMmd, maxChunkChars)) {
    chunkIndex += 1;
    console.log(
      `[DPP Extraction] Processing chunk ${chunkIndex}/${totalApproxChunks} (len=${chunk.length})...`
    );

    const questions = await extractQuestionsFromChunk(chunk, solutionsMmd, chunkIndex - 1, supabase);

    // Basic validation + de-dupe (keeps DB inserts smaller / avoids runaway memory)
    const cleaned = (questions || [])
      .filter((q: any) => q && typeof q.question_number === 'number' && Array.isArray(q.options))
      .map((q: any) => ({
        ...q,
        question_text:
          typeof q.question_text === 'string' ? q.question_text.slice(0, 5000) : '',
        options: (q.options || []).slice(0, 4).map((o: any) => ({
          id: String(o?.id ?? '').slice(0, 5),
          text: typeof o?.text === 'string' ? o.text.slice(0, 1500) : '',
        })),
        correct_answer: String(q.correct_answer ?? '').slice(0, 5),
        difficulty: q.difficulty || 'medium',
        explanation: typeof q.explanation === 'string' ? q.explanation.slice(0, 6000) : null,
      }))
      .filter((q: any) => q.question_text && q.options.length === 4 && q.correct_answer);

    const unique: any[] = [];
    for (const q of cleaned) {
      if (seenQuestionNumbers.has(q.question_number)) continue;
      seenQuestionNumbers.add(q.question_number);
      unique.push(q);

      if (previewQuestions.length < previewLimit) {
        previewQuestions.push(q);
      }
    }

    if (unique.length === 0) {
      console.log(`[DPP Extraction] Chunk ${chunkIndex}: no valid unique questions`);
      continue;
    }

    // Map AI difficulty values to database enum values
    const mapDifficulty = (aiDiff: string): string => {
      const mapping: Record<string, string> = {
        'easy': 'Low',
        'medium': 'Medium',
        'hard': 'Advanced',
      };
      return mapping[aiDiff?.toLowerCase()] || 'Medium';
    };

    // Convert options from array to object format for questions table
    const toInsert = unique.map((q: any) => {
      // Convert options array to object format { a: 'text', b: 'text', ... }
      const optionsObj: Record<string, string> = {};
      if (Array.isArray(q.options)) {
        q.options.forEach((opt: any) => {
          if (opt.id && opt.text) {
            optionsObj[opt.id.toLowerCase()] = opt.text;
          }
        });
      }
      
      return {
        topic_id: topicId,
        chapter_id: chapterId,
        question_text: q.question_text,
        question_type: 'mcq',
        question_format: 'objective',
        options: optionsObj,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        difficulty: mapDifficulty(q.difficulty),
        source_document_purpose: 'dpp',
        source_document_id: documentId,
        is_ai_generated: true,
        is_verified: false,
      };
    });

    // Insert in batches of 50 to questions table
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error: insertError } = await supabase.from('questions').insert(batch);
      if (insertError) {
        console.error(`[DPP Extraction] Insert error (chunk ${chunkIndex}, batch ${i}):`, insertError);
        throw insertError;
      }
      totalInserted += batch.length;
    }

    // Brief delay to avoid bursting compute/network
    await delay(200);
  }

  return { questionsCount: totalInserted, previewQuestions };
}

function* iterateTextChunks(text: string, maxChars: number): Generator<string> {
  let start = 0;
  const boundaryRegex = /\n\[Page \d+\]|\n\d+\.\s+/g;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    // Try to cut at a nicer boundary near the end of the window
    if (end < text.length) {
      const lookback = Math.min(5000, end - start);
      const window = text.slice(end - lookback, end);

      boundaryRegex.lastIndex = 0;
      let lastMatchIndex = -1;
      let m: RegExpExecArray | null = null;
      while ((m = boundaryRegex.exec(window))) {
        lastMatchIndex = m.index;
      }

      // Only use boundary if it won't create a tiny chunk
      if (lastMatchIndex > 1000) {
        end = end - lookback + lastMatchIndex;
      }
    }

    // Safety to prevent infinite loops
    if (end <= start) {
      end = Math.min(start + maxChars, text.length);
    }

    yield text.slice(start, end);
    start = end;
  }
}

// Tool schema for structured output - avoids JSON parsing issues with LaTeX
const extractionTool = {
  type: "function",
  function: {
    name: "extract_mcq_questions",
    description: "Extract MCQ questions from educational document text",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dpp_number: { type: "number", description: "DPP number if mentioned in header" },
              question_number: { type: "number", description: "Question number from document" },
              question_text: { type: "string", description: "Complete question with LaTeX math preserved" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "Option letter (a, b, c, d)" },
                    text: { type: "string", description: "Option text with LaTeX preserved" }
                  },
                  required: ["id", "text"]
                }
              },
              correct_answer: { type: "string", description: "Correct option letter (a, b, c, or d)" },
              explanation: { type: "string", description: "Explanation if available" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
            },
            required: ["question_number", "question_text", "options", "correct_answer", "difficulty"]
          }
        }
      },
      required: ["questions"]
    }
  }
};

async function extractQuestionsFromChunk(chunk: string, solutionsMmd: string, chunkIndex: number, supabase: any): Promise<any[]> {
  // Get AI configuration from database
  const { data: aiConfig } = await supabase
    .from('ai_settings')
    .select('setting_value')
    .eq('setting_key', 'ai_api_config')
    .maybeSingle();

  const config = aiConfig?.setting_value as any;

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
    throw new Error('AI API not configured. Please go to Admin → Settings → AI Functions API Key Settings to add your API key.');
  }

  const systemPrompt = `You are an expert at extracting MCQ questions from educational documents.

TASK: Extract ALL MCQ questions from the provided text chunk using the extract_mcq_questions function.

RULES:
1. Preserve ALL mathematical formulas as LaTeX ($...$ for inline, $$...$$ for display)
2. Include chemical formulas correctly
3. Do NOT skip any questions - extract every single MCQ
4. Each question MUST have exactly 4 options (a, b, c, d)
5. If answer key is visible, use it for correct_answer
6. Estimate difficulty: easy (basic), medium (application), hard (complex/multi-step)

ANSWER EXTRACTION:
- Look for answer patterns like "Ans: (b)", "Answer: B", "(b)", etc.
- If no answer visible, make best guess based on solutions if provided`;

  const userPrompt = `QUESTIONS CHUNK:
${chunk}

${solutionsMmd ? `SOLUTIONS (for answer reference):
${solutionsMmd.slice(0, 5000)}` : ''}

Extract ALL MCQ questions from the above text.`;

  const maxRetries = 2;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[DPP Extraction] Retry attempt ${attempt} for chunk ${chunkIndex + 1}`);
      await delay(attempt * 1500);
    }
    
    try {
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
          tool_choice: { type: "function", function: { name: "extract_mcq_questions" } },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DPP Extraction] AI API error:', response.status, error);
        
        if (response.status === 429) {
          if (attempt < maxRetries) {
            lastError = new Error('Rate limit exceeded');
            continue;
          }
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid or unauthorized API key. Please check your API key in Admin Settings.');
        }
        
        if (attempt < maxRetries) {
          lastError = new Error(`AI API error: ${response.status}`);
          continue;
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const result = await response.json();
      const message = result.choices?.[0]?.message;
      
      let parsed: any = null;
      
      // Try to get structured output from tool_calls first
      if (message?.tool_calls?.[0]?.function?.arguments) {
        try {
          const toolArgs = message.tool_calls[0].function.arguments;
          parsed = JSON.parse(toolArgs);
          console.log(`[DPP Extraction] Chunk ${chunkIndex + 1}: Extracted ${parsed.questions?.length || 0} questions via tool_calls`);
        } catch (toolParseError) {
          console.error('[DPP Extraction] Failed to parse tool_calls:', toolParseError);
        }
      }
      
      // Fallback: try parsing from content if tool_calls failed
      if (!parsed && message?.content) {
        try {
          let jsonText = message.content.trim();
          
          // Remove markdown code blocks
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }
          
          // Try to find JSON object or array
          const objectMatch = jsonText.match(/\{[\s\S]*\}/);
          const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
          
          if (objectMatch) {
            parsed = JSON.parse(objectMatch[0]);
          } else if (arrayMatch) {
            parsed = { questions: JSON.parse(arrayMatch[0]) };
          }
          
          if (parsed) {
            console.log(`[DPP Extraction] Chunk ${chunkIndex + 1}: Extracted ${parsed.questions?.length || 0} questions via content fallback`);
          }
        } catch (contentParseError) {
          console.error('[DPP Extraction] Failed to parse content:', contentParseError);
        }
      }
      
      if (parsed?.questions && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      
      console.warn(`[DPP Extraction] Chunk ${chunkIndex + 1}: No questions extracted`);
      return [];
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries && !lastError.message.includes('API key')) {
        continue;
      }
      throw lastError;
    }
  }
  
  throw lastError || new Error('Extraction failed after retries');
}
