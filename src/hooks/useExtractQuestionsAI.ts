import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ExtractedQuestion } from "./usePreviousYearQuestions";
import type { DocumentAnalysis } from "@/types/documentAnalysis";

interface ExtractQuestionsParams {
  contentJson?: any | null;
  contentMarkdown?: string;
  examName: string;
  year: number;
  paperType?: string;
  documentType?: "mcq" | "practice" | "proficiency";
  // NEW: Document analysis from Phase 1 (optional - enables dynamic prompts)
  documentAnalysis?: DocumentAnalysis;
}

export interface ExtractQuestionsResponse {
  success: boolean;
  questions: ExtractedQuestion[];
  questionsCount: number;
  partial?: boolean;
  error?: string;
  errorCode?: string;
  errors?: string[];
  chunksProcessed?: number;
  answerKeyStats?: {
    found: number;
    applied: number;
    missing: number[];
  };
  extractionStats?: {
    expected: number;
    extracted: number;
    recoveryAttempts: number;
    recoveredInRetries: number;
    stillMissing: number[];
    completionRate: string;
  };
}

export function useExtractQuestionsAI() {
  return useMutation({
    mutationFn: async ({
      contentJson,
      contentMarkdown,
      examName,
      year,
      paperType,
      documentType,
      documentAnalysis,
    }: ExtractQuestionsParams): Promise<ExtractQuestionsResponse> => {
      const { data, error } = await supabase.functions.invoke("extract-questions-preview", {
        body: { contentJson: contentJson ?? null, contentMarkdown, examName, year, paperType, documentType, documentAnalysis },
      });

      if (error) {
        console.error("Error calling extract-questions-preview:", error);
        throw new Error(error.message || "Failed to extract questions");
      }

      return (data || {
        success: false,
        questions: [],
        questionsCount: 0,
        error: "Empty response from server",
        errorCode: "EMPTY_RESPONSE",
      }) as ExtractQuestionsResponse;
    },
    onSuccess: (data) => {
      if (!data.success) {
        if (data.errorCode === "RATE_LIMIT") {
          toast.error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (data.errorCode === "CREDITS_EXHAUSTED") {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else if (data.errorCode === "NO_QUESTIONS") {
          toast.info("No MCQs were detected in this PDF.");
        } else if (data.error) {
          toast.error(data.error);
        }
        return;
      }

      if (data.partial) {
        toast.warning(`Extracted ${data.questionsCount} questions (partial result).`);
      } else {
        toast.success(`Extracted ${data.questionsCount} questions.`);
      }
    },
    onError: (error: Error) => {
      console.error("AI extraction error:", error);
      toast.error(`Failed to extract questions: ${error.message}`);
    },
  });
}
