import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SubjectData {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
}

interface CheckerCourseData {
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

export const useCheckerCourseData = (courseId?: string, enabled = false) => {
  return useQuery({
    queryKey: ["checker-course-data", courseId],
    queryFn: async (): Promise<CheckerCourseData> => {
      if (!courseId) return { course: null, subjects: [], isEnrolled: false, error: null };

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, name, slug, thumbnail_url, available_languages, language_topup_price, language_topup_original_price")
        .eq("id", courseId)
        .maybeSingle();

      if (courseError || !course) {
        return { course: null, subjects: [], isEnrolled: false, error: "course_not_found" };
      }

      const { data: courseSubjects } = await supabase
        .from("course_subjects")
        .select("subject_id, display_order, popular_subjects(id, name, slug, thumbnail_url)")
        .eq("course_id", courseId)
        .order("display_order");

      const subjects: SubjectData[] = (courseSubjects || [])
        .map((cs: any) => cs.popular_subjects)
        .filter(Boolean)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          thumbnail_url: s.thumbnail_url,
        }));

      return {
        course: {
          id: course.id,
          name: course.name,
          slug: course.slug,
          thumbnail_url: course.thumbnail_url,
          available_languages: course.available_languages as string[] | null,
          language_topup_price: course.language_topup_price,
          language_topup_original_price: course.language_topup_original_price,
        },
        subjects,
        isEnrolled: true, // Checker has access to all
        error: null,
      };
    },
    enabled: enabled && !!courseId,
    staleTime: 60000,
  });
};
