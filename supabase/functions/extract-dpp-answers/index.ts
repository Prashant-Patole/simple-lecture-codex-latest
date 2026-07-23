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
    const { documentId, fullMmd } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: documentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting answers for document ${documentId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all questions for this document from the QUESTIONS table (not dpp_questions)
    const { data: questions, error: fetchError } = await supabase
      .from('questions')
      .select('id')
      .eq('source_document_id', documentId)
      .is('correct_answer', null)  // Only get questions without answers
      .order('id', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch questions: ${fetchError.message}`);
    }

    console.log(`Found ${questions?.length || 0} questions without answers to update`);

    // Extract answer key from the full document
    const totalQuestions = questions?.length || 0;
    const answerMap = await extractAnswerKey(fullMmd, totalQuestions, supabase);
    console.log(`Extracted ${Object.keys(answerMap).length} answers from document`);

    // Update questions with correct answers (by order, since questions table doesn't have question_number)
    let answersApplied = 0;
    const missingAnswers: number[] = [];

    for (let i = 0; i < (questions?.length || 0); i++) {
      const question = questions![i];
      const questionNumber = i + 1;  // 1-indexed
      const answer = answerMap[questionNumber];
      
      if (answer) {
        const { error: updateError } = await supabase
          .from('questions')
          .update({ correct_answer: answer.toUpperCase() })
          .eq('id', question.id);

        if (!updateError) {
          answersApplied++;
        } else {
          console.error(`Error updating question ${question.id}:`, updateError);
        }
      } else {
        missingAnswers.push(questionNumber);
      }
    }

    // Update dpp_documents status to completed (if dppDocumentId was provided separately)
    // The documentId here is actually the source_document_id from uploaded_question_documents
    // We need to find the corresponding dpp_document
    const { data: dppDoc } = await supabase
      .from('dpp_documents')
      .select('id')
      .eq('file_url', documentId)  // Try matching by file_url which might contain doc ID
      .maybeSingle();

    // Also try updating any dpp_document with matching status
    const { error: docUpdateError } = await supabase
      .from('dpp_documents')
      .update({ 
        status: 'completed',
        questions_count: totalQuestions
      })
      .eq('status', 'extracting_answers');  // Update any in extracting_answers state

    if (docUpdateError) {
      console.error('Error updating document status:', docUpdateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        answersApplied,
        totalQuestions: questions?.length || 0,
        missingAnswers: missingAnswers.length > 0 ? missingAnswers : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error extracting answers:', error);
    const message = error instanceof Error ? error.message : 'Failed to extract answers';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractAnswerKey(fullMmd: string, expectedCount: number, supabase: any): Promise<Record<number, string>> {
  const answerMap: Record<number, string> = {};

  // Try regex patterns first (faster and more reliable for common formats)
  // IMPORTANT: Only use precise patterns to avoid false positives from question numbers
  
  // Pattern 1: Dedicated ANSWER KEY section with "1. A" or "1) A" format
  const answerKeySection = fullMmd.match(/(?:ANSWER\s*KEY|ANSWERS?)[\s\S]*?(?=\n\n|\z)/i);
  if (answerKeySection) {
    const section = answerKeySection[0];
    const keyPattern = /\b(\d+)\s*[.):\-]\s*([A-Da-d])\b/gi;
    let km;
    while ((km = keyPattern.exec(section)) !== null) {
      const qNum = parseInt(km[1]);
      if (qNum <= 200) {  // Reasonable question number limit
        answerMap[qNum] = km[2].toUpperCase();
      }
    }
    console.log(`Found ${Object.keys(answerMap).length} answers in ANSWER KEY section`);
  }

  // Pattern 2: SOLUTION section answers - "1. (a)" or "Sol. 1: (b)"
  const solutionMatches = fullMmd.matchAll(/(?:Sol(?:ution)?\.?\s*)?(\d+)\s*[.):\-]\s*\(([A-Da-d])\)/gi);
  for (const match of solutionMatches) {
    const qNum = parseInt(match[1]);
    if (qNum <= 200 && !answerMap[qNum]) {
      answerMap[qNum] = match[2].toUpperCase();
    }
  }

  // Pattern 3: Table format "| 1 | A |" or "| 1 | (a) |"
  const tablePattern = /\|\s*(\d+)\s*\|\s*\(?([A-Da-d])\)?\s*\|/gi;
  let tableMatch;
  while ((tableMatch = tablePattern.exec(fullMmd)) !== null) {
    const qNum = parseInt(tableMatch[1]);
    if (qNum <= 200 && !answerMap[qNum]) {
      answerMap[qNum] = tableMatch[2].toUpperCase();
    }
  }

  // Pattern 4: Inline "Ans: (a)" or "Answer: b" format
  const ansInlinePattern = /(?:Ans(?:wer)?[:.\s]+)\(?([A-Da-d])\)?/gi;
  // This needs context - find which question it belongs to
  const lines = fullMmd.split('\n');
  let currentQuestion = 0;
  for (const line of lines) {
    // Check if line starts with a question number
    const qNumMatch = line.match(/^(\d+)\s*[.)]/);
    if (qNumMatch) {
      currentQuestion = parseInt(qNumMatch[1]);
    }
    // Check for inline answer
    const ansMatch = line.match(/(?:Ans(?:wer)?[:.\s]+)\(?([A-Da-d])\)?/i);
    if (ansMatch && currentQuestion > 0 && currentQuestion <= 200 && !answerMap[currentQuestion]) {
      answerMap[currentQuestion] = ansMatch[1].toUpperCase();
    }
  }

  // Pattern 5: Compact answer list "1(A) 2(B) 3(C)" - only in answer sections
  const compactSection = fullMmd.match(/(?:ANSWER|KEY|SOLUTION)[\s\S]{0,500}?(\d+\s*\([A-Da-d]\)[\s\S]*?)(?:\n\n|$)/i);
  if (compactSection) {
    const compactPattern = /(\d+)\s*\(([A-Da-d])\)/g;
    let cm;
    while ((cm = compactPattern.exec(compactSection[1])) !== null) {
      const qNum = parseInt(cm[1]);
      if (qNum <= 200 && !answerMap[qNum]) {
        answerMap[qNum] = cm[2].toUpperCase();
      }
    }
  }

  console.log(`Regex extraction found ${Object.keys(answerMap).length} answers`);
  
  // If we found enough answers with regex, return
  if (Object.keys(answerMap).length >= expectedCount * 0.5) {
    return answerMap;
  }

  // Fall back to AI extraction if regex didn't find enough
  console.log('Falling back to AI for answer extraction');
  const aiAnswers = await extractAnswersWithAI(fullMmd, expectedCount, supabase);
  
  // Merge AI answers (AI takes precedence for missing ones)
  for (const [qNum, answer] of Object.entries(aiAnswers)) {
    if (!answerMap[parseInt(qNum)]) {
      answerMap[parseInt(qNum)] = answer;
    }
  }

  return answerMap;
}

async function extractAnswersWithAI(content: string, expectedCount: number, supabase: any): Promise<Record<number, string>> {
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
    return {};
  }

  // Only send the last portion of the document where answers typically are
  const truncatedContent = content.length > 15000 
    ? content.slice(-15000) 
    : content;

  const systemPrompt = `You are an expert at extracting correct answers from educational documents.

The document may contain answers in various formats:
1. A dedicated "ANSWER KEY" section with format like "1. A, 2. B, 3. C"
2. A "SOLUTION" section where each question shows the correct answer as "(a)", "(b)", etc.
3. Inline answers where correct option is marked with "Ans:" or similar
4. Table format with question numbers and corresponding answers

Look for patterns like:
- "1. (a)" or "1. A" in answer sections
- "Ans: (a)" or "Answer: a" 
- "Sol. 1: (b)" format
- Table rows with question number and answer letter

Extract the correct answer (A, B, C, or D) for each question number.
Only include answers you are confident about.`;

  const userPrompt = `Extract the answer key from this document. Expected around ${expectedCount} questions.
Return answers in format: question_number -> answer (A/B/C/D)

Document content:
${truncatedContent}`;

  const extractionTool = {
    type: "function",
    function: {
      name: "extract_answers",
      description: "Extract answer key mapping",
      parameters: {
        type: "object",
        properties: {
          answers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_number: { type: "number" },
                correct_answer: { type: "string", enum: ["A", "B", "C", "D"] }
              },
              required: ["question_number", "correct_answer"]
            }
          }
        },
        required: ["answers"]
      }
    }
  };

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
        tool_choice: { type: "function", function: { name: "extract_answers" } }
      })
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return {};
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      const result: Record<number, string> = {};
      for (const ans of parsed.answers || []) {
        result[ans.question_number] = ans.correct_answer;
      }
      return result;
    }
  } catch (error) {
    console.error('AI extraction error:', error);
  }

  return {};
}
