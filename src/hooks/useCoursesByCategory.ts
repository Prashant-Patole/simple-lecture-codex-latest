import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCoursesByCategory = (categoryId?: string) => {
  return useQuery({
    queryKey: ["courses-by-category", categoryId],
    queryFn: async () => {
      if (!categoryId) {
        // Return all active courses if no category selected
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_categories!inner(category_id)
        `)
        .eq("course_categories.category_id", categoryId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};
