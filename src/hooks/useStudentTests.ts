import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentTest {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  duration_minutes: number;
  total_marks: number;
  test_type: string;
  created_at: string;
  is_active: boolean;
  question_count: number;
}

export const useStudentTests = (
  subjectId: string | null,
  testTypes?: string | string[],
  topicId?: string | null,
  chapterId?: string | null,
  chapterOnly?: boolean
) => {
  return useQuery({
    queryKey: ["student-tests", subjectId, testTypes, topicId, chapterId, chapterOnly],
    queryFn: async () => {
      if (!subjectId) return [];
      
      // OPTIMIZED: Single query with count subquery instead of N+1
      let query = supabase
        .from("tests")
        .select(`
          *,
          question_count:test_questions(count)
        `)
        .eq("subject_id", subjectId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      // Filter by test types
      if (testTypes) {
        if (Array.isArray(testTypes)) {
          query = query.in("test_type", testTypes);
        } else {
          query = query.eq("test_type", testTypes);
        }
      }
      
      // Filter by topic/chapter if provided
      if (topicId) {
        query = query.eq("topic_id", topicId);
      } else if (chapterId) {
        if (chapterOnly) {
          // Only tests directly on this chapter, not its topics
          query = query.eq("chapter_id", chapterId).is("topic_id", null);
        } else {
          query = query.eq("chapter_id", chapterId);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Flatten the count subquery result
      return (data || []).map((test: any) => ({
        ...test,
        question_count: test.question_count?.[0]?.count || 0
      })) as StudentTest[];
    },
    enabled: !!subjectId,
  });
};
