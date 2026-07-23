import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocumentAnalysis } from "@/types/documentAnalysis";

export interface ExtractedPYQQuestion {
  question_number: number;
  question_text: string;
  question_format: "mcq" | "subjective" | "true_false";
  options: Record<string, { text: string }> | null;
  marks: number;
  difficulty: string;
}

interface ExtractPYQParams {
  contentJson?: any | null;
  contentMarkdown?: string;
  documentAnalysis?: DocumentAnalysis;
}

interface ExtractPYQResponse {
  success: boolean;
  questions: ExtractedPYQQuestion[];
  questionsCount: number;
  estimatedCount?: number;
  chunksProcessed?: number;
  error?: string;
  errorCode?: string;
}

export function useExtractPYQQuestionsAI() {
  return useMutation({
    mutationFn: async ({ contentJson, contentMarkdown, documentAnalysis }: ExtractPYQParams): Promise<ExtractPYQResponse> => {
      console.log("[useExtractPYQQuestionsAI] Starting extraction. JSON present:", contentJson != null, "Markdown length:", contentMarkdown?.length || 0, "Analysis present:", !!documentAnalysis);

      // Use AbortController for 300s timeout (parallel chunked processing needs time)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      try {
        const { data, error } = await supabase.functions.invoke("extract-pyq-questions", {
          body: { contentJson: contentJson ?? null, contentMarkdown, documentAnalysis },
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error("[useExtractPYQQuestionsAI] Edge function error:", error);
          throw new Error(error.message || "Failed to extract PYQ questions");
        }

        const response = (data || {
          success: false,
          questions: [],
          questionsCount: 0,
          error: "Empty response from server",
          errorCode: "EMPTY_RESPONSE",
        }) as ExtractPYQResponse;

        console.log("[useExtractPYQQuestionsAI] Result:", {
          success: response.success,
          questionsCount: response.questionsCount,
          estimatedCount: response.estimatedCount,
          chunksProcessed: response.chunksProcessed,
          error: response.error,
          errorCode: response.errorCode,
        });

        return response;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          throw new Error("Extraction timed out after 5 minutes. Try a smaller document.");
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      if (!data.success) {
        if (data.errorCode === "RATE_LIMIT") toast.error("Rate limit exceeded. Try again shortly.");
        else if (data.errorCode === "AI_NOT_CONFIGURED") toast.error("AI API not configured. Please set up API keys in AI Settings.");
        else if (data.errorCode === "NO_QUESTIONS") toast.warning("No questions could be extracted. The document may not contain recognizable question patterns.");
        else if (data.error) toast.error(data.error);
        return;
      }
      const extra = data.chunksProcessed && data.chunksProcessed > 1 ? ` (${data.chunksProcessed} chunks)` : "";
      toast.success(`Extracted ${data.questionsCount} questions${extra}.`);
    },
    onError: (error: Error) => {
      console.error("PYQ extraction error:", error);
      toast.error(`Extraction failed: ${error.message}`);
    },
  });
}
