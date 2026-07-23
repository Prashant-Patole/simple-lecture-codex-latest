import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useAISuggestChapterTopic = () => {
  return useMutation({
    mutationFn: async (params: {
      questionText: string;
      subjectId: string;
      subjectName?: string;
      categoryName?: string;
      existingChapters?: any[];
      existingTopics?: any[];
      existingSubtopics?: any[];
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "ai-suggest-chapter-topic",
        { body: params }
      );
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      if (error.message.includes('429')) {
        toast.error("Rate limit exceeded", {
          description: "Please try again in a few moments"
        });
      } else if (error.message.includes('402')) {
        toast.error("Payment required", {
          description: "Please add credits to your AI workspace"
        });
      } else {
        toast.error("AI suggestion failed", {
          description: error.message
        });
      }
    }
  });
};
