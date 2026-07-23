import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useGenerateSolution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId }: { questionId: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "ai-generate-solution",
        { body: { questionId } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Solution generated successfully");
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to generate solution", {
        description: error.message
      });
    }
  });
};
