import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TopicVisibilityMode = "both" | "hide_marketing" | "hide_lecture";

export const useTopicLectureVisibility = (topicId?: string | null) => {
  return useQuery({
    queryKey: ["topic-lecture-visibility", topicId],
    queryFn: async (): Promise<TopicVisibilityMode> => {
      if (!topicId) return "both";
      const { data, error } = await supabase
        .from("topic_lecture_visibility")
        .select("mode")
        .eq("topic_id", topicId)
        .maybeSingle();
      if (error) throw error;
      return (data?.mode as TopicVisibilityMode) ?? "both";
    },
    enabled: !!topicId,
    staleTime: 60 * 1000,
  });
};

export const useSetTopicLectureVisibility = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ topicId, mode }: { topicId: string; mode: TopicVisibilityMode }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("topic_lecture_visibility")
        .upsert(
          { topic_id: topicId, mode, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: "topic_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["topic-lecture-visibility", vars.topicId] });
      qc.invalidateQueries({ queryKey: ["published-ai-lectures"] });
    },
  });
};
