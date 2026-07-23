import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aggregates per-topic published-lecture stats (count + duration in minutes)
 * across multiple subjects by calling `get_published_lecture_stats` per
 * subject in parallel. Only topics with at least one student-watchable
 * lecture are present in the maps.
 */
export function useCoursePublishedLectureStats(subjectIds: string[]) {
  const sorted = [...(subjectIds || [])].filter(Boolean).sort();
  const key = sorted.join(",");

  return useQuery({
    queryKey: ["course-published-lecture-stats", key],
    enabled: sorted.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const results = await Promise.all(
        sorted.map((id) =>
          supabase.rpc("get_published_lecture_stats", { p_subject_id: id })
        )
      );
      const durationByTopic: Record<string, number> = {};
      const lectureCountByTopic: Record<string, number> = {};
      for (const { data, error } of results) {
        if (error) throw error;
        for (const row of (data || []) as any[]) {
          if (!row?.topic_id) continue;
          if (typeof row.total_duration_minutes === "number") {
            durationByTopic[row.topic_id] = row.total_duration_minutes;
          }
          if (typeof row.lecture_count === "number") {
            lectureCountByTopic[row.topic_id] = row.lecture_count;
          }
        }
      }
      return { durationByTopic, lectureCountByTopic };
    },
  });
}
