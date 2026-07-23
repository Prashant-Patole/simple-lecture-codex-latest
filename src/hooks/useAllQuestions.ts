import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAllQuestions = (topicId?: string, chapterId?: string, chapterOnly?: boolean) => {
  return useQuery({
    queryKey: ["all-questions", topicId, chapterId, chapterOnly],
    queryFn: async () => {
      let query = supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: true });

      if (chapterOnly && chapterId) {
        query = query.eq("chapter_id", chapterId);
      } else if (topicId) {
        query = query.eq("topic_id", topicId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!topicId || !!chapterId,
    staleTime: 1000 * 60 * 10,
  });
};
