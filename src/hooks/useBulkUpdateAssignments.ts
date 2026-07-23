import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useBulkUpdateAssignments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionIds,
      chapterId,
      topicId,
      subtopicId
    }: {
      questionIds: string[];
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
        .in('id', questionIds);

      if (error) throw error;
      return questionIds.length;
    },
    onSuccess: (count) => {
      toast.success(`Updated ${count} question assignments`);
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to bulk update assignments", {
        description: error.message
      });
    }
  });
};
