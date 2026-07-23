import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsChecker = () => {
  const { user } = useAuth();

  const { data: isChecker = false, isLoading } = useQuery({
    queryKey: ["is-checker", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "checker");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { isChecker, isLoading };
};
