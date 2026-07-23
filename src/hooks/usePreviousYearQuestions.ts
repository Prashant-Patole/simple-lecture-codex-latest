import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ExtractedQuestion {
  question_text: string;
  question_type: string; // Accept any string, normalize on save
  question_format: string; // Accept any string, normalize on save
  options: Record<string, { text: string }>;
  correct_answer: string;
  explanation?: string;
  difficulty: string;
  marks?: number;
  question_number?: number;
  is_important?: boolean;
  answer_source?: "document" | "ai_generated";
}

interface BulkInsertParams {
  questions: ExtractedQuestion[];
  paperId?: string | null;
  topicId?: string;
  subjectId: string;
  chapterId: string;
  documentPurpose?: string;
  sourceDocumentId?: string;
}

// O(1) lookup - normalize options to standard format: { A: { text: "..." }, B: { text: "..." } }
const normalizeOptions = (
  options: Record<string, any> | undefined
): Record<string, { text: string }> => {
  if (!options || typeof options !== 'object') return {};
  
  const normalized: Record<string, { text: string }> = {};
  
  for (const [key, value] of Object.entries(options)) {
    // Normalize key to uppercase A-E
    const upperKey = key.toUpperCase();
    if (!/^[A-E]$/.test(upperKey)) continue;
    
    // Handle both flat and nested formats
    const text = typeof value === 'string' 
      ? value 
      : (value?.text || String(value));
    
    normalized[upperKey] = { text };
  }
  
  return normalized;
};

// O(1) lookup - normalize extracted types to DB-allowed types
const normalizeQuestionType = (type: string): "mcq" | "subjective" | "true_false" | "integer" => {
  const t = (type || "mcq").toLowerCase();
  
  // Direct mappings
  if (t === "mcq" || t === "single_choice" || t === "multiple_choice") return "mcq";
  if (t === "integer" || t === "numerical") return "integer";
  if (t === "true_false") return "true_false";
  
  // Written types → subjective
  if (t === "written" || t === "subjective" || t === "fill_blank" || 
      t === "short_answer" || t === "long_answer" || t === "match" || 
      t === "assertion_reason") {
    return "subjective";
  }
  
  return "mcq"; // Default fallback
};

// O(1) lookup - normalize format to DB-allowed formats
const normalizeQuestionFormat = (format: string, type: string): string => {
  const f = (format || "").toLowerCase();
  const normalizedType = normalizeQuestionType(type);
  
  if (f === "single_choice" || f === "mcq") return "single_choice";
  if (f === "multiple_choice") return "multiple_choice";
  if (f === "true_false") return "true_false";
  if (f === "integer" || f === "numerical") return "integer";
  
  // For subjective types
  if (normalizedType === "subjective") return "subjective";
  
  return "single_choice"; // Default
};

// O(1) lookup - normalize difficulty to DB-allowed values
const normalizeDifficulty = (diff: string): string => {
  const d = (diff || "medium").toLowerCase();
  if (d.includes("easy") || d.includes("simple") || d === "low") return "Low";
  if (d.includes("hard") || d.includes("difficult") || d === "advanced") return "Advanced";
  if (d.includes("intermediate")) return "Intermediate";
  return "Medium";
};

export const useBulkInsertPreviousYearQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questions, paperId, topicId, subjectId, chapterId, documentPurpose, sourceDocumentId }: BulkInsertParams) => {
      // O(n) - Single pass to normalize and format all questions
      const formattedQuestions = questions.map((q) => ({
        question_text: q.question_text,
        question_type: normalizeQuestionType(q.question_type),
        question_format: normalizeQuestionFormat(q.question_format, q.question_type),
        options: normalizeOptions(q.options),
        correct_answer: q.correct_answer?.toUpperCase() || '',
        explanation: q.explanation || null,
        difficulty: normalizeDifficulty(q.difficulty),
        marks: q.marks || 1,
        topic_id: topicId || null,
        chapter_id: chapterId || null,
        previous_year_paper_id: paperId || null,
        is_verified: false,
        is_ai_generated: true,
        is_important: q.is_important || false,
        source_document_purpose: documentPurpose || 'general',
        source_document_id: sourceDocumentId || null,
      }));

      // O(n) - Create batches
      const batchSize = 50;
      const batches: typeof formattedQuestions[] = [];
      for (let i = 0; i < formattedQuestions.length; i += batchSize) {
        batches.push(formattedQuestions.slice(i, i + batchSize));
      }

      // O(1) time complexity - All batches execute in parallel
      const results = await Promise.all(
        batches.map(batch => supabase.from("questions").insert(batch))
      );

      // Check for errors across all batches
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        const errorMessages = errors.map(e => e.error?.message).filter(Boolean).join("; ");
        throw new Error(errorMessages || "Batch insert failed");
      }

      return { insertedCount: formattedQuestions.length, paperId, subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      queryClient.invalidateQueries({ queryKey: ["subject-uploaded-documents", data.subjectId] });
      toast({
        title: "Questions Saved",
        description: `Successfully saved ${data.insertedCount} questions`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to save questions: " + error.message,
        variant: "destructive",
      });
    },
  });
};

// Helper function to extract questions from parsed PDF JSON
export function extractQuestionsFromParsedJson(
  parsedContent: any
): ExtractedQuestion[] {
  const questions: ExtractedQuestion[] = [];

  if (!parsedContent) return questions;

  // Handle different possible formats from the parser
  if (Array.isArray(parsedContent)) {
    parsedContent.forEach((item, index) => {
      const q = parseQuestionItem(item, index + 1);
      if (q) questions.push(q);
    });
  } else if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
    parsedContent.questions.forEach((item: any, index: number) => {
      const q = parseQuestionItem(item, index + 1);
      if (q) questions.push(q);
    });
  } else if (parsedContent.children && Array.isArray(parsedContent.children)) {
    let qNum = 1;
    parsedContent.children.forEach((child: any) => {
      if (child.type === "question" || child.question_text || child.text) {
        const q = parseQuestionItem(child, qNum);
        if (q) {
          questions.push(q);
          qNum++;
        }
      }
    });
  }

  return questions;
}

function parseQuestionItem(item: any, defaultNumber: number): ExtractedQuestion | null {
  if (!item) return null;

  const questionText = item.question_text || item.question || item.text || "";
  if (!questionText.trim()) return null;

  // Parse options - handle multiple formats
  let options: Record<string, { text: string }> = {};
  
  if (item.options) {
    if (Array.isArray(item.options)) {
      const keys = ["A", "B", "C", "D", "E", "F"];
      item.options.forEach((opt: any, i: number) => {
        if (i < keys.length) {
          options[keys[i]] = { text: typeof opt === "string" ? opt : opt.text || String(opt) };
        }
      });
    } else if (typeof item.options === "object") {
      Object.entries(item.options).forEach(([key, value]) => {
        if (typeof value === "string") {
          options[key] = { text: value };
        } else if (typeof value === "object" && value !== null) {
          options[key] = { text: (value as any).text || String(value) };
        }
      });
    }
  }

  // Try to extract from choice_a, choice_b, etc.
  if (Object.keys(options).length === 0) {
    ["A", "B", "C", "D", "E"].forEach((key) => {
      const choiceKey = `choice_${key.toLowerCase()}`;
      const optKey = `option_${key.toLowerCase()}`;
      const value = item[choiceKey] || item[optKey] || item[key] || item[key.toLowerCase()];
      if (value) {
        options[key] = { text: typeof value === "string" ? value : String(value) };
      }
    });
  }

  // Parse correct answer
  let correctAnswer = item.correct_answer || item.answer || item.correct || "";
  if (typeof correctAnswer !== "string") {
    correctAnswer = String(correctAnswer);
  }
  const cleanedAnswer = correctAnswer.replace(/[()]/g, "").trim();
  
  // Determine question type
  const hasOptions = Object.keys(options).length > 0;
  const isIntegerAnswer = /^-?\d+\.?\d*$/.test(cleanedAnswer) && cleanedAnswer.length > 1;
  
  const questionType = isIntegerAnswer ? "integer" : hasOptions ? "mcq" : "subjective";
  const questionFormat = isIntegerAnswer ? "integer" : hasOptions ? "single_choice" : "subjective";

  const finalAnswer = isIntegerAnswer ? cleanedAnswer : cleanedAnswer.toUpperCase().charAt(0);

  // Parse difficulty
  let difficulty = "Medium";
  const diffStr = (item.difficulty || item.level || "").toLowerCase();
  if (diffStr.includes("easy") || diffStr.includes("low")) {
    difficulty = "Low";
  } else if (diffStr.includes("hard") || diffStr.includes("advanced")) {
    difficulty = "Advanced";
  } else if (diffStr.includes("intermediate")) {
    difficulty = "Intermediate";
  }

  return {
    question_text: questionText,
    question_type: questionType,
    question_format: questionFormat,
    options,
    correct_answer: finalAnswer,
    explanation: item.explanation || item.solution || undefined,
    difficulty,
    marks: item.marks || item.mark || 1,
    question_number: item.question_number || item.number || defaultNumber,
  };
}
