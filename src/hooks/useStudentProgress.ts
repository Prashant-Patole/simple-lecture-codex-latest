import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useStudentProgress = (studentId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch student progress
  const { data: progress, isLoading } = useQuery({
    queryKey: ["student-progress", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_progress")
        .select(`
          *,
          chapter:chapters(
            id,
            title,
            subject,
            course:courses(name)
          ),
          topic:topics(
            id,
            title
          )
        `)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Update progress mutation
  const updateProgress = useMutation({
    mutationFn: async ({
      topicId,
      chapterId,
      score,
      timeSpent,
    }: {
      topicId: string;
      chapterId: string;
      score?: number;
      timeSpent?: number;
    }) => {
      const { data, error } = await supabase
        .from("student_progress")
        .upsert({
          student_id: studentId,
          topic_id: topicId,
          chapter_id: chapterId,
          score: score,
          time_spent_seconds: timeSpent,
          is_completed: score !== undefined && score >= 70,
          completed_at: score !== undefined && score >= 70 ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-progress", studentId] });
      toast({
        title: "Progress Updated",
        description: "Your progress has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update progress.",
        variant: "destructive",
      });
    },
  });

  return {
    progress,
    isLoading,
    updateProgress: updateProgress.mutate,
    isUpdating: updateProgress.isPending,
  };
};
