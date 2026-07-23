import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSubjectsByCategory = (categoryId?: string) => {
  return useQuery({
    queryKey: ["subjects-by-category", categoryId],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      if (!categoryId) return [];

      const { data, error } = await supabase
        .from("popular_subjects")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });
};
