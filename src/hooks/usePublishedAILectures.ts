import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PresentationReview } from "@/hooks/useVideoGenerationJobs";

// List view interface - minimal data for cards
export interface PublishedAILecture {
  id: string;
  document_name: string | null;
  external_job_id: string | null;
  video_url: string | null;
  created_at: string | null;
  topic_id: string | null;
  chapter_id: string | null;
  target_port: number | null;
  is_marketing: boolean;
}

// Full details interface - includes heavy presentation_json
export interface PublishedAILectureDetails extends PublishedAILecture {
  presentation_json: PresentationReview | null;
}

// OPTIMIZED: List view - excludes heavy presentation_json (~200KB reduction per lecture)
export const usePublishedAILectures = (topicId?: string, chapterId?: string, options?: { skipVisibilityFilter?: boolean }) => {
  const skipVisibilityFilter = options?.skipVisibilityFilter ?? false;
  return useQuery({
    queryKey: ['published-ai-lectures', topicId, chapterId, skipVisibilityFilter ? 'raw' : 'filtered'],
    queryFn: async () => {
      let query = supabase
        .from('video_generation_jobs')
        .select(`
          id,
          document_name,
          external_job_id,
          video_url,
          created_at,
          target_port,
          is_marketing,
          ai_assistant_documents!inner(topic_id, chapter_id)
        `)
        .eq('is_published', true)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (topicId) {
        query = query.eq('ai_assistant_documents.topic_id', topicId);
      } else if (chapterId) {
        query = query.eq('ai_assistant_documents.chapter_id', chapterId)
          .is('ai_assistant_documents.topic_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      const lectures = (data || []).map((job: any) => ({
        id: job.id,
        document_name: job.document_name,
        external_job_id: job.external_job_id,
        video_url: job.video_url,
        created_at: job.created_at,
        topic_id: job.ai_assistant_documents?.topic_id || null,
        chapter_id: job.ai_assistant_documents?.chapter_id || null,
        target_port: job.target_port ?? null,
        is_marketing: !!job.is_marketing,
      })) as PublishedAILecture[];


      // Apply per-topic visibility filter (student-side only)
      if (topicId && !skipVisibilityFilter) {
        const { data: vis } = await supabase
          .from('topic_lecture_visibility')
          .select('mode')
          .eq('topic_id', topicId)
          .maybeSingle();
        const mode = (vis?.mode as 'both' | 'hide_marketing' | 'hide_lecture' | undefined) ?? 'both';
        if (mode === 'hide_marketing') return lectures.filter((l) => !l.is_marketing);
        if (mode === 'hide_lecture') return lectures.filter((l) => l.is_marketing);
      }

      return lectures;
    },
    enabled: !!(topicId || chapterId),
  });
};

// NEW: Lazy-load heavy lecture details only when needed (opening player dialog)
export const useAILectureDetails = (lectureId?: string) => {
  return useQuery({
    queryKey: ['ai-lecture-details', lectureId],
    queryFn: async () => {
      if (!lectureId) return null;

      const { data, error } = await supabase
        .from('video_generation_jobs')
        .select(`
          id,
          document_name,
          external_job_id,
          presentation_json,
          video_url,
          created_at,
          target_port,
          is_marketing,
          ai_assistant_documents!inner(topic_id, chapter_id)
        `)
        .eq('id', lectureId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        document_name: data.document_name,
        external_job_id: data.external_job_id,
        presentation_json: data.presentation_json as unknown as PresentationReview | null,
        video_url: data.video_url,
        created_at: data.created_at,
        topic_id: (data.ai_assistant_documents as any)?.topic_id || null,
        chapter_id: (data.ai_assistant_documents as any)?.chapter_id || null,
        target_port: (data as any).target_port ?? null,
        is_marketing: !!(data as any).is_marketing,

      } as PublishedAILectureDetails;
    },
    enabled: !!lectureId,
    staleTime: 5 * 60 * 1000,
  });
};
