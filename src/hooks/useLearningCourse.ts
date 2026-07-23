import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

// Hook to wait for auth state to be ready
export const useAuthReady = () => {
  const [isReady, setIsReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setIsReady(true);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isReady, userId };
};

interface SubjectData {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
}

interface LearningCourseData {
  course: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    available_languages: string[] | null;
    language_topup_price: number | null;
    language_topup_original_price: number | null;
  } | null;
  subjects: SubjectData[];
  isEnrolled: boolean;
  error: string | null;
}

export const useLearningCourse = (courseId?: string) => {
  const { isReady, userId } = useAuthReady();

  return useQuery({
    queryKey: ["learning-course", courseId, userId],
    queryFn: async (): Promise<LearningCourseData> => {
      if (!courseId) return { course: null, subjects: [], isEnrolled: false, error: null };

      // Use cached session instead of making network request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return { course: null, subjects: [], isEnrolled: false, error: "not_authenticated" };
      }

      // OPTIMIZED: Single RPC call instead of 3 sequential roundtrips
      const { data, error } = await supabase.rpc('get_learning_course_data', {
        p_course_id: courseId,
        p_student_id: session.user.id
      });

      if (error) {
        console.error("Learning course data error:", error);
        return { course: null, subjects: [], isEnrolled: false, error: "fetch_error" };
      }

      // RPC returns an array, get first row
      const result = data?.[0];

      if (!result || !result.is_enrolled) {
        return { course: null, subjects: [], isEnrolled: false, error: "not_enrolled" };
      }

      // Parse the subjects JSONB - ensure proper typing
      const subjectsArray = Array.isArray(result.subjects) ? result.subjects : [];
      const subjects: SubjectData[] = subjectsArray.map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        thumbnail_url: s.thumbnail_url || null,
      }));

      return {
        course: {
          id: result.course_id,
          name: result.course_name,
          slug: result.course_slug,
          thumbnail_url: result.thumbnail_url,
          available_languages: result.available_languages as string[] | null,
          language_topup_price: result.language_topup_price,
          language_topup_original_price: result.language_topup_original_price,
        },
        subjects,
        isEnrolled: true,
        error: null
      };
    },
    enabled: !!courseId && isReady,
    staleTime: 60000, // Cache for 1 minute
  });
};

interface TopicData {
  id: string;
  title: string;
  topic_number: number | string;
  estimated_duration_minutes: number | null;
  video_id: string | null;
  video_platform: string | null;
  ai_generated_video_url: string | null;
}

interface ChapterWithTopics {
  id: string;
  title: string;
  chapter_number: number;
  description: string | null;
  ai_generated_video_url: string | null;
  topics: TopicData[];
  progress: number;
}

export const useSubjectChapters = (subjectId?: string) => {
  return useQuery({
    queryKey: ["subject-chapters-learning", subjectId],
    queryFn: async (): Promise<ChapterWithTopics[]> => {
      if (!subjectId) return [];

      // OPTIMIZED: Single RPC call instead of 2 sequential queries
      const { data, error } = await supabase.rpc('get_subject_chapters_with_topics', {
        p_subject_id: subjectId
      });

      if (error) {
        console.error("Chapters fetch error:", error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Transform RPC result to expected format
      return data.map((chapter: any) => ({
        id: chapter.chapter_id,
        title: chapter.title,
        chapter_number: chapter.chapter_number,
        description: chapter.description,
        ai_generated_video_url: chapter.ai_generated_video_url,
        topics: (chapter.topics || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          topic_number: t.topic_number,
          estimated_duration_minutes: t.estimated_duration_minutes,
          video_id: t.video_id,
          video_platform: t.video_platform,
          ai_generated_video_url: t.ai_generated_video_url,
          chapter_id: chapter.chapter_id,
        })),
        progress: 0, // Progress will be calculated separately if needed
      }));
    },
    enabled: !!subjectId,
    staleTime: 60000, // Cache for 1 minute
  });
};
