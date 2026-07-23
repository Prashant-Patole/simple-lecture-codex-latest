import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { mockFollowups } from "@/data/mockStudents";

interface CreateFollowupParams {
  student_id: string;
  followup_type: "test_reminder" | "live_class_reminder" | "ai_tutorial_prompt" | "general";
  message: string;
  priority: "low" | "medium" | "high";
  scheduled_for: string;
}

export const useFollowups = (studentId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: followups, isLoading } = useQuery({
    queryKey: ["followups", studentId],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (studentId) {
        return mockFollowups[studentId] || [];
      }
      
      // Return all followups
      return Object.values(mockFollowups).flat();
    },
  });

  const createFollowup = useMutation({
    mutationFn: async (params: CreateFollowupParams) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return { id: `followup-${Date.now()}`, ...params, status: "pending", created_at: new Date().toISOString() };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast({
        title: "Follow-up Created",
        description: "The follow-up has been scheduled successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create follow-up.",
        variant: "destructive",
      });
    },
  });

  const updateFollowupStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast({
        title: "Status Updated",
        description: "Follow-up status has been updated.",
      });
    },
  });

  return {
    followups,
    isLoading,
    createFollowup: createFollowup.mutate,
    isCreating: createFollowup.isPending,
    updateFollowupStatus: updateFollowupStatus.mutate,
  };
};
