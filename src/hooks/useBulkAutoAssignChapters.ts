import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useBulkAutoAssignChapters = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "bulk-auto-assign-chapters",
        { body: { documentId } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Auto-assignment completed", {
        description: `Assigned ${data.assignedCount} out of ${data.totalQuestions} questions`
      });
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
      queryClient.invalidateQueries({ queryKey: ["uploaded-documents"] });
    },
    onError: (error: Error) => {
      toast.error("Bulk auto-assignment failed", {
        description: error.message
      });
    }
  });
};
