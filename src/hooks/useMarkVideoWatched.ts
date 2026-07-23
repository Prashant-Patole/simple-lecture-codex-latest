import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MarkVideoWatchedParams {
  videoTitle: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
}

export const useMarkVideoWatched = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoTitle,
      subjectId,
      chapterId,
      topicId,
    }: MarkVideoWatchedParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if already watched
      const { data: existing } = await supabase
        .from('ai_video_watch_logs')
        .select('id')
        .eq('student_id', user.id)
        .eq('video_title', videoTitle)
        .maybeSingle();

      if (existing) {
        // Already watched, skip insert
        return existing;
      }

      // Insert new watch record
      const { data, error } = await supabase
        .from('ai_video_watch_logs')
        .insert({
          student_id: user.id,
          video_title: videoTitle,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          topic_id: topicId || null,
          completion_percentage: 100,
          watched_seconds: 0,
          duration_seconds: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate related queries to refresh progress
      queryClient.invalidateQueries({ queryKey: ['dashboard-course-details'] });
      queryClient.invalidateQueries({ queryKey: ['subject-content-progress'] });
      queryClient.invalidateQueries({ queryKey: ['my-classes-data'] });
    },
  });
};

// New hook to update watch time when closing lecture
export const useUpdateVideoWatchTime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoTitle,
      additionalSeconds,
    }: {
      videoTitle: string;
      additionalSeconds: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find existing record
      const { data: existing } = await supabase
        .from('ai_video_watch_logs')
        .select('id, watched_seconds')
        .eq('student_id', user.id)
        .eq('video_title', videoTitle)
        .maybeSingle();

      if (existing) {
        // Update with additional time
        const { data, error } = await supabase
          .from('ai_video_watch_logs')
          .update({
            watched_seconds: (existing.watched_seconds || 0) + additionalSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      // If no record exists, it will be created by useMarkVideoWatched
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-classes-data'] });
    },
  });
};
