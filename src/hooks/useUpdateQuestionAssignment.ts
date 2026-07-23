import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useUpdateQuestionAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      chapterId,
      topicId,
      subtopicId
    }: {
      questionId: string;
      chapterId: string;
      topicId: string;
      subtopicId?: string | null;
    }) => {
      const { error } = await supabase
        .from('parsed_questions_pending')
        .update({
          chapter_id: chapterId,
          topic_id: topicId,
          subtopic_id: subtopicId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question assignment updated");
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update assignment", {
        description: error.message
      });
    }
  });
};
