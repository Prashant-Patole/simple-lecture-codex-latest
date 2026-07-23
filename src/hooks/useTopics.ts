import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTopics = (chapterId?: string) => {
  return useQuery({
    queryKey: ['topics', chapterId],
    queryFn: async () => {
      if (!chapterId) return [];

      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('sequence_order');
      
      if (error) {
        console.log('Topics query error:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!chapterId,
  });
};
