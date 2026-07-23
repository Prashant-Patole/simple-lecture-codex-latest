import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aggregates per-topic published-lecture durations (in minutes) across
 * multiple subjects by calling the `get_topic_lecture_durations` RPC in
 * parallel. Returns a `{ topicId: minutes }` map — only topics with a
 * published lecture are present, so it doubles as a visibility filter.
 */
export function useCourseTopicLectureDurations(subjectIds: string[]) {
  const sorted = [...(subjectIds || [])].filter(Boolean).sort();
  const key = sorted.join(",");

  return useQuery({
    queryKey: ["course-topic-lecture-durations", key],
    enabled: sorted.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const results = await Promise.all(
        sorted.map((id) =>
          supabase.rpc("get_topic_lecture_durations", { p_subject_id: id })
        )
      );
      const map: Record<string, number> = {};
      for (const { data, error } of results) {
        if (error) throw error;
        for (const row of (data || []) as any[]) {
          if (row?.topic_id && typeof row.total_duration_minutes === "number") {
            map[row.topic_id] = row.total_duration_minutes;
          }
        }
      }
      return map;
    },
  });
}
