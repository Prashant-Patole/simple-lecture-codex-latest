import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ExtractQuestionsParams {
  contentJson: any;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  subtopicId?: string;
  entityType: "chapter" | "topic" | "subtopic";
  entityName: string;
}

interface ExtractQuestionsResult {
  success: boolean;
  questionsCount: number;
  message?: string;
  error?: string;
}

export const useExtractJsonQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ExtractQuestionsParams): Promise<ExtractQuestionsResult> => {
      const { data, error } = await supabase.functions.invoke("extract-json-to-questions", {
        body: params,
      });

      if (error) {
        throw new Error(error.message || "Failed to extract questions");
      }

      return data as ExtractQuestionsResult;
    },
    onSuccess: (data) => {
      if (data.questionsCount > 0) {
        toast({
          title: "Questions Extracted",
          description: data.message || `Successfully extracted ${data.questionsCount} questions to question bank`,
        });
        // Invalidate questions queries to refresh the question bank
        queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      } else {
        toast({
          title: "No Questions Found",
          description: data.message || "No MCQs were found in the document content",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      console.error("Extract questions error:", error);
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract questions from document",
        variant: "destructive",
      });
    },
  });
};
