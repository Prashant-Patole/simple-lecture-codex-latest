import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTopicLectureDurations(subjectId?: string | null) {
  return useQuery({
    queryKey: ["topic-lecture-durations", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_topic_lecture_durations", {
        p_subject_id: subjectId!,
      });

      if (error) throw error;

      const map: Record<string, number> = {};
      for (const row of data || []) {
        map[row.topic_id] = row.total_duration_minutes;
      }
      return map;
    },
    enabled: !!subjectId,
    staleTime: 5 * 60 * 1000,
  });
}
