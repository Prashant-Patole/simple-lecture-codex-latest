import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_QUESTIONS = 300;
const CHUNK_SIZE = 100000;
const CHUNK_OVERLAP = 5000;

interface ExtractedPYQQuestion {
  question_number: number;
  question_text: string;
  question_format: "mcq" | "subjective" | "true_false";
  options: Record<string, { text: string }> | null;
  marks: number;
  difficulty: string;
}

// --- Regex pre-scan to estimate question count ---
function preScanDocument(text: string): { estimatedCount: number; patterns: string[] } {
  const patterns: string[] = [];
  let total = 0;

  // Pattern: 1. or 1) 
  const numbered = text.match(/(?:^|\n)\s*\d{1,3}\s*[\.\)]\s+\S/g);
  if (numbered && numbered.length > 3) {
    total = Math.max(total, numbered.length);
    patterns.push(`${numbered.length} numbered (1. or 1))`);
  }

  // Pattern: Q.1 or Q1 or Q 1
  const qPrefixed = text.match(/(?:^|\n)\s*Q\.?\s*\d{1,3}/gi);
  if (qPrefixed && qPrefixed.length > 2) {
    total = Math.max(total, qPrefixed.length);
    patterns.push(`${qPrefixed.length} Q-prefixed`);
  }

  // Pattern: (1) or (i) 
  const parens = text.match(/(?:^|\n)\s*\(\d{1,3}\)\s+\S/g);
  if (parens && parens.length > 3) {
    total = Math.max(total, parens.length);
    patterns.push(`${parens.length} parenthesized`);
  }

  // Pattern: Question 1 or Question: 
  const questionWord = text.match(/(?:^|\n)\s*question\s*[\d:]/gi);
  if (questionWord && questionWord.length > 1) {
    total = Math.max(total, questionWord.length);
    patterns.push(`${questionWord.length} 'Question N' format`);
  }

  return { estimatedCount: total || 20, patterns };
}

// --- Split document into chunks ---
function chunkDocument(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    // Try to break at a newline near the end
    if (end < text.length) {
      const lastNewline = text.lastIndexOf("\n", end);
      if (lastNewline > start + CHUNK_SIZE * 0.7) end = lastNewline;
    }
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    if (chunks.length >= 4) break; // safety cap
  }
  console.log(`[PYQ] Document chunked into ${chunks.length} parts (total ${text.length} chars)`);
  return chunks;
}

// --- Normalize raw AI output into clean questions ---
function normalizeQuestions(raw: any[]): ExtractedPYQQuestion[] {
  const seen = new Set<number>();
  const result: ExtractedPYQQuestion[] = [];

  for (const q of raw) {
    const num = Number(q.question_number || q.number || 0);
    if (num <= 0 || num > MAX_QUESTIONS || seen.has(num)) continue;
    seen.add(num);

    let format: ExtractedPYQQuestion["question_format"] = "subjective";
    const qType = String(q.question_format || q.question_type || "").toLowerCase();
    if (qType === "mcq" || qType === "single_choice" || qType === "multiple_choice") {
      format = "mcq";
    } else if (qType === "true_false") {
      format = "true_false";
    } else if (q.options && typeof q.options === "object" && Object.keys(q.options).length >= 2) {
      format = "mcq";
    }

    let options: Record<string, { text: string }> | null = null;
    if (format === "mcq" && q.options) {
      options = {};
      if (Array.isArray(q.options)) {
        const labels = ["A", "B", "C", "D", "E"];
        q.options.forEach((opt: any, i: number) => {
          if (i < labels.length) {
            const text = typeof opt === "string" ? opt : (opt?.text || String(opt));
            options![labels[i]] = { text };
          }
        });
      } else if (typeof q.options === "object") {
        for (const [key, val] of Object.entries(q.options)) {
          const normalKey = key.toUpperCase().replace(/[^A-E]/g, "");
          if (normalKey && normalKey.length === 1) {
            const text = typeof val === "string" ? val : ((val as any)?.text || String(val));
            options![normalKey] = { text };
          }
        }
      }
    }

    let difficulty = "Medium";
    const rawDiff = String(q.difficulty || "medium").toLowerCase();
    if (rawDiff.includes("easy") || rawDiff.includes("low")) difficulty = "Low";
    else if (rawDiff.includes("hard") || rawDiff.includes("advanced")) difficulty = "Advanced";
    else if (rawDiff.includes("intermediate")) difficulty = "Intermediate";

    const questionText = String(q.question_text || q.text || q.question || "").trim();
    if (!questionText || questionText.length < 3) continue;

    result.push({
      question_number: num,
      question_text: questionText,
      question_format: format,
      options,
      marks: Number(q.marks || q.mark || 1),
      difficulty,
    });
  }

  return result.sort((a, b) => a.question_number - b.question_number);
}

// --- Try to parse questions from any AI response ---
function parseAIResponse(message: any): any[] | null {
  // 1. Try tool_calls
  const toolArgs = message?.tool_calls?.[0]?.function?.arguments;
  if (toolArgs) {
    try {
      const parsed = typeof toolArgs === "string" ? JSON.parse(toolArgs) : toolArgs;
      const qs = parsed.questions || (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(qs) && qs.length > 0) {
        console.log(`[PYQ] Parsed ${qs.length} questions from tool_calls`);
        return qs;
      }
    } catch (e) {
      console.error("[PYQ] Failed to parse tool_calls arguments:", e);
    }
  }

  // 2. Try content as JSON
  const content = message?.content || "";
  if (content) {
    try {
      let jsonText = content.trim();
      if (jsonText.startsWith("```")) jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      // Try to find a JSON object with questions array
      const objMatch = jsonText.match(/\{[\s\S]*"questions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          console.log(`[PYQ] Parsed ${parsed.questions.length} questions from content JSON object`);
          return parsed.questions;
        }
      }
      // Try as direct array
      const arrMatch = jsonText.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const parsed = JSON.parse(arrMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question_text) {
          console.log(`[PYQ] Parsed ${parsed.length} questions from content JSON array`);
          return parsed;
        }
      }
    } catch (e) {
      console.error("[PYQ] Failed to parse content as JSON:", e);
    }
  }

  return null;
}

// --- Get AI config ---
async function getAIConfig(): Promise<{ apiUrl: string; apiKey: string; model: string } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: aiConfig } = await supabase
    .from("ai_settings")
    .select("setting_value")
    .eq("setting_key", "ai_api_config")
    .maybeSingle();

  const config = aiConfig?.setting_value as any;

  if (config?.enabled && config?.provider === "openrouter" && config?.openrouter_api_key) {
    apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    apiKey = config.openrouter_api_key;
    model = config.default_model || "google/gemini-2.5-flash";
  } else if (config?.enabled && config?.provider === "google" && config?.google_api_key) {
    return {
      apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: config.google_api_key,
      model: config.default_model || "gemini-2.5-flash",
    };
  } else if (config?.enabled && config?.provider === "openai" && config?.openai_api_key) {
    return {
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: config.openai_api_key,
      model: config.default_model || "gpt-4o",
    };
  }
  return null;
}

// --- Call AI for a single chunk ---
async function extractFromChunk(
  aiConfig: { apiUrl: string; apiKey: string; model: string },
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  estimatedCount: number,
  preScanPatterns: string[],
): Promise<ExtractedPYQQuestion[]> {
  const systemPrompt = `You are an expert document question extractor. Read the ENTIRE document content below thoroughly.

Your job:
1. Identify ALL questions in this document — MCQ, subjective, true/false, fill-in-blank, match-the-following, short answer, long answer, or any other type
2. Extract each question with its EXACT text as written in the document
3. Do NOT extract, generate, or include answers, solutions, answer keys, or explanations
4. Detect the question format automatically
5. Preserve ALL mathematical notation (LaTeX, KaTeX, formulas) exactly as written
6. Preserve image references (like ![image](...)) exactly

For each question return:
- question_number: sequential integer starting from 1
- question_text: the exact question text from the document
- question_format: "mcq" (has options A/B/C/D), "subjective" (written/short/long answer), or "true_false"
- options: for MCQ only, { "A": "option text", "B": "option text", ... }. null for non-MCQ
- marks: estimated marks (default 1)
- difficulty: "Low" | "Medium" | "Intermediate" | "Advanced"

CRITICAL: Extract EVERY question you find. Do not skip any. ${totalChunks > 1 ? `This is chunk ${chunkIndex + 1} of ${totalChunks}. Continue sequential numbering from where the previous chunk left off.` : ""}
Pre-scan found approximately ${estimatedCount} questions${preScanPatterns.length > 0 ? ` (formats: ${preScanPatterns.join(", ")})` : ""}.`;

  const userPrompt = `Extract ALL questions from this document content. Do NOT include answers or solutions.\n\nDocument content:\n${chunkText}`;

  const tools = [{
    type: "function",
    function: {
      name: "extract_questions",
      description: "Extract all questions from a document (no answers)",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_number: { type: "number" },
                question_text: { type: "string" },
                question_format: { type: "string", enum: ["mcq", "subjective", "true_false"] },
                options: {
                  type: "object",
                  description: "MCQ options. Null for non-MCQ.",
                  additionalProperties: { type: "string" },
                },
                marks: { type: "number" },
                difficulty: { type: "string", enum: ["Low", "Medium", "Intermediate", "Advanced"] },
              },
              required: ["question_number", "question_text", "question_format"],
            },
          },
        },
        required: ["questions"],
      },
    },
  }];

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000));

      console.log(`[PYQ] Chunk ${chunkIndex + 1}/${totalChunks}, attempt ${attempt + 1}, text length: ${chunkText.length}`);

      const response = await fetch(aiConfig.apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${aiConfig.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "extract_questions" } },
          temperature: 0.1 + attempt * 0.1,
          max_tokens: 64000,
        }),
      });

      if (response.status === 429) {
        console.warn(`[PYQ] Rate limited on attempt ${attempt + 1}`);
        if (attempt < maxRetries) continue;
        throw new Error("Rate limited");
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[PYQ] API error ${response.status}:`, errText.slice(0, 500));
        if (attempt < maxRetries) continue;
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const finishReason = data.choices?.[0]?.finish_reason;

      console.log(`[PYQ] AI response - finish_reason: ${finishReason}, has_tool_calls: ${!!message?.tool_calls}, content_length: ${(message?.content || "").length}`);

      const rawQuestions = parseAIResponse(message);
      if (rawQuestions && rawQuestions.length > 0) {
        const normalized = normalizeQuestions(rawQuestions);
        console.log(`[PYQ] Chunk ${chunkIndex + 1}: extracted ${normalized.length} valid questions from ${rawQuestions.length} raw`);
        return normalized;
      }

      console.warn(`[PYQ] Chunk ${chunkIndex + 1}: no questions parsed on attempt ${attempt + 1}`);
      if (attempt < maxRetries) continue;
    } catch (err) {
      console.error(`[PYQ] Chunk ${chunkIndex + 1} attempt ${attempt + 1} failed:`, err);
      if (attempt >= maxRetries) throw err;
    }
  }

  return [];
}

// --- Merge questions from multiple chunks ---
function mergeChunkResults(chunkResults: ExtractedPYQQuestion[][]): ExtractedPYQQuestion[] {
  const allQuestions: ExtractedPYQQuestion[] = [];
  const seenTexts = new Set<string>();

  for (const chunk of chunkResults) {
    for (const q of chunk) {
      // Deduplicate by first 80 chars of question text
      const key = q.question_text.slice(0, 80).toLowerCase().replace(/\s+/g, " ");
      if (seenTexts.has(key)) continue;
      seenTexts.add(key);
      allQuestions.push(q);
    }
  }

  // Re-number sequentially
  return allQuestions.map((q, i) => ({ ...q, question_number: i + 1 }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentJson, contentMarkdown, documentAnalysis } = await req.json();

    console.log("=== PYQ Question Extraction (Robust) ===");

    // Prepare extraction text
    let extractionText = "";
    if (contentMarkdown && typeof contentMarkdown === "string" && contentMarkdown.length > 100) {
      extractionText = contentMarkdown;
    } else if (contentJson) {
      extractionText = typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson);
    }

    if (!extractionText || extractionText.length < 50) {
      console.error("[PYQ] No valid content. Markdown length:", contentMarkdown?.length || 0, "JSON present:", contentJson != null);
      return new Response(
        JSON.stringify({ success: false, questions: [], questionsCount: 0, error: "No valid document content provided", errorCode: "NO_CONTENT" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PYQ] Content length: ${extractionText.length} chars`);

    // Pre-scan
    const { estimatedCount, patterns } = preScanDocument(extractionText);
    console.log(`[PYQ] Pre-scan: ~${estimatedCount} questions. Patterns: ${patterns.join(", ") || "none detected"}`);

    // Use documentAnalysis if available (optional enhancement)
    const analysisCount = documentAnalysis?.totalEstimatedQuestions;
    const finalEstimate = analysisCount || estimatedCount;
    console.log(`[PYQ] Final estimate: ${finalEstimate} (analysis: ${analysisCount || "N/A"}, pre-scan: ${estimatedCount})`);

    // Get AI config
    const aiConfig = await getAIConfig();
    if (!aiConfig) {
      return new Response(
        JSON.stringify({ success: false, questions: [], questionsCount: 0, error: "AI API not configured. Please configure Google or OpenAI API key in AI Settings.", errorCode: "AI_NOT_CONFIGURED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PYQ] Using model: ${aiConfig.model}`);

    // Chunk document if needed
    const chunks = chunkDocument(extractionText);
    // Process all chunks in parallel
    console.log(`[PYQ] Processing ${chunks.length} chunk(s) in parallel...`);
    const chunkResults = await Promise.all(
      chunks.map((chunk, i) => extractFromChunk(aiConfig, chunk, i, chunks.length, finalEstimate, patterns))
    );

    // Merge results
    const questions = chunks.length === 1 ? chunkResults[0] : mergeChunkResults(chunkResults);

    console.log(`[PYQ] Final result: ${questions.length} questions extracted from ${chunks.length} chunk(s)`);

    return new Response(
      JSON.stringify({
        success: questions.length > 0,
        questions,
        questionsCount: questions.length,
        estimatedCount: finalEstimate,
        chunksProcessed: chunks.length,
        error: questions.length === 0 ? "No questions could be extracted from this document. The AI could not identify question patterns." : undefined,
        errorCode: questions.length === 0 ? "NO_QUESTIONS" : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[PYQ] Fatal extraction error:", error);
    return new Response(
      JSON.stringify({ success: false, questions: [], questionsCount: 0, error: error.message || "Extraction failed", errorCode: "EXTRACTION_ERROR" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
