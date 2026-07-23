import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId?: string | null) => {
  return useQuery({
    queryKey: ["user-role", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      
      return data?.role || null;
    },
    enabled: !!userId,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
