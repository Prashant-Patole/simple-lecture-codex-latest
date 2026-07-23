import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVerifySingleQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId }: { questionId: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "llm-verify-single-question",
        { body: { questionId } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const status = data.verification.status;
      const message = status === 'correct' ? 'Question verified - looks good!' 
        : status === 'medium' ? 'Question verified - needs review'
        : 'Question verified - issues found';
      
      toast.success(message, {
        description: data.verification.comments
      });
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to verify question", {
        description: error.message
      });
    }
  });
};
