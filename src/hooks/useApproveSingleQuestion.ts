import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useApproveSingleQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId }: { questionId: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "approve-and-transfer-questions",
        { body: { questionIds: [questionId] } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Question approved and transferred to question bank");
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
      queryClient.invalidateQueries({ queryKey: ["uploaded-documents"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to approve question", {
        description: error.message
      });
    }
  });
};
