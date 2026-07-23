import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGoalCourses = (goalId?: string) => {
  return useQuery({
    queryKey: ["goal-courses", goalId],
    queryFn: async () => {
      if (!goalId) return [];

      const { data, error } = await supabase
        .from("course_goals")
        .select(`
          id,
          course_id,
          courses (
            id,
            name,
            slug,
            thumbnail_url,
            short_description,
            price_inr,
            original_price_inr,
            duration_months,
            student_count
          )
        `)
        .eq("goal_id", goalId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!goalId,
  });
};

export const useAddCourseToGoal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ goalId, courseId }: { goalId: string; courseId: string }) => {
      const { data, error } = await supabase
        .from("course_goals")
        .insert({ goal_id: goalId, course_id: courseId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goal-courses", variables.goalId] });
      toast({
        title: "Success",
        description: "Course mapped to goal successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to map course to goal",
        variant: "destructive",
      });
    },
  });
};

export const useRemoveCourseFromGoal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ mappingId, goalId }: { mappingId: string; goalId: string }) => {
      const { error } = await supabase
        .from("course_goals")
        .delete()
        .eq("id", mappingId);

      if (error) throw error;
      return { goalId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["goal-courses", data.goalId] });
      toast({
        title: "Success",
        description: "Course removed from goal successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove course from goal",
        variant: "destructive",
      });
    },
  });
};
