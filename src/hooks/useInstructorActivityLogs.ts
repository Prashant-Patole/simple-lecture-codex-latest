import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAuthUser } from "@/hooks/useCurrentAuthUser";

export const useInstructorActivityLogs = (limit: number = 100) => {
  const { data: authUser } = useCurrentAuthUser();

  return useQuery({
    queryKey: ["instructor-activity-logs", authUser?.id, limit],
    queryFn: async () => {
      if (!authUser?.id) return [];

      const { data, error } = await supabase
        .from("instructor_activity_log")
        .select("*")
        .eq("instructor_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.id,
  });
};
