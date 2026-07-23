import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAuthUser } from "@/hooks/useCurrentAuthUser";

interface LogActivityParams {
  action: string;
  action_type: string;
  metadata?: Record<string, any>;
}

export const useLogInstructorActivity = () => {
  const queryClient = useQueryClient();
  const { data: authUser } = useCurrentAuthUser();

  return useMutation({
    mutationFn: async ({ action, action_type, metadata = {} }: LogActivityParams) => {
      if (!authUser?.id) {
        console.warn("No authenticated user for activity logging");
        return null;
      }

      const { data, error } = await supabase
        .from("instructor_activity_log")
        .insert({
          instructor_id: authUser.id,
          action,
          action_type,
          metadata,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to log activity:", error);
        // Don't throw - logging shouldn't break the app
        return null;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-activity-logs"] });
    },
  });
};
