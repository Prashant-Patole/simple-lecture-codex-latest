import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocumentAnalysis } from "@/types/documentAnalysis";

interface AnalyzeDocumentParams {
  contentMarkdown?: string;
  contentJson?: any;
  documentName?: string;
}

interface AnalyzeDocumentResponse {
  success: boolean;
  analysis?: DocumentAnalysis;
  error?: string;
  errorCode?: string;
}

export function useAnalyzeDocument() {
  return useMutation({
    mutationFn: async ({
      contentMarkdown,
      contentJson,
      documentName,
    }: AnalyzeDocumentParams): Promise<DocumentAnalysis> => {
      const { data, error } = await supabase.functions.invoke("analyze-document-structure", {
        body: { contentMarkdown, contentJson, documentName },
      });

      if (error) {
        console.error("Error calling analyze-document-structure:", error);
        throw new Error(error.message || "Failed to analyze document");
      }

      const response = data as AnalyzeDocumentResponse;

      if (!response.success || !response.analysis) {
        throw new Error(response.error || "Analysis returned no results");
      }

      return response.analysis;
    },
    onSuccess: (analysis) => {
      const typesSummary = analysis.questionTypes
        .map(t => `${t.count} ${t.type}`)
        .join(", ");
      toast.success(`Document analyzed: ~${analysis.totalEstimatedQuestions} questions (${typesSummary})`);
    },
    onError: (error: Error) => {
      console.error("Document analysis error:", error);
      toast.error(`Analysis failed: ${error.message}`);
    },
  });
}
