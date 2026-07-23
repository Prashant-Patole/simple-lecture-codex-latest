import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAllSubjects = () => {
  return useQuery({
    queryKey: ["all-subjects"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select(`
          id,
          name,
          category_id,
          categories(id, name)
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
};
