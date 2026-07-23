import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { refreshLearningResults } from "@/lib/refreshLearningResults";

export interface TestResult {
  id: string;
  student_id: string;
  test_id: string;
  subject_id: string | null;
  topic_id?: string | null;
  chapter_id?: string | null;
  test_type: string;
  score: number | null;
  total_questions: number;
  percentage: number | null;
  time_taken_seconds: number | null;
  answers: Record<string, string>;
  grading_status: string;
  submitted_at: string;
  graded_at: string | null;
  created_at: string;
  test?: {
    title: string;
    test_type: string;
    duration_minutes: number;
    subject_id?: string | null;
    topic_id?: string | null;
    chapter_id?: string | null;
    topic?: { title: string; chapter?: { title: string } | null } | null;
    chapter?: { title: string } | null;
  };
}

export const useTestResults = (subjectId?: string | null, topicId?: string | null, chapterId?: string | null) => {
  return useQuery({
    queryKey: ["test-results", subjectId, topicId, chapterId],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Left join on `tests` so fallback practice rows (test_id = null) are still returned.
      // Do not filter by subject at the DB level: older practice rows may have
      // subject_id null but can still be matched through topic/chapter/test metadata.
      let query = supabase
        .from("test_results")
        .select(`
          *,
          topic_id,
          chapter_id,
          test:tests(title, test_type, duration_minutes, subject_id, topic_id, chapter_id, topic:subject_topics(title, chapter:subject_chapters(title)), chapter:subject_chapters(title))
        `)
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as any[];

      const answeredQuestionIds = Array.from(
        new Set(
          rows.flatMap((r) => Object.keys((r.answers || {}) as Record<string, unknown>))
            .filter(Boolean)
        )
      );

      const questionScopeById = new Map<string, { topic_id: string | null; chapter_id: string | null }>();
      if (answeredQuestionIds.length > 0) {
        const { data: questionRows } = await supabase
          .from("questions")
          .select("id, topic_id, chapter_id")
          .in("id", answeredQuestionIds);

        (questionRows || []).forEach((q: any) => {
          questionScopeById.set(q.id, { topic_id: q.topic_id || null, chapter_id: q.chapter_id || null });
        });
      }

      const getAnsweredQuestionScope = (r: any) => {
        const ids = Object.keys((r.answers || {}) as Record<string, unknown>);
        const topicIds = new Set<string>();
        const chapterIds = new Set<string>();
        ids.forEach((id) => {
          const scope = questionScopeById.get(id);
          if (scope?.topic_id) topicIds.add(scope.topic_id);
          if (scope?.chapter_id) chapterIds.add(scope.chapter_id);
        });
        return { topicIds, chapterIds };
      };

      let subjectTopicIds: Set<string> | null = null;
      let subjectChapterIds: Set<string> | null = null;
      if (subjectId) {
        const { data: chapterRows } = await supabase
          .from("subject_chapters")
          .select("id")
          .eq("subject_id", subjectId);
        subjectChapterIds = new Set((chapterRows || []).map((c: any) => c.id));

        if (subjectChapterIds.size > 0) {
          const { data: topicRows } = await supabase
            .from("subject_topics")
            .select("id, chapter_id")
            .in("chapter_id", Array.from(subjectChapterIds));
          subjectTopicIds = new Set((topicRows || []).map((t: any) => t.id));
        } else {
          subjectTopicIds = new Set();
        }
      }

      // For chapter-level scope, resolve the chapter's topic ids so we can
      // match rows saved with only topic_id (chapter_id null).
      let chapterTopicIds: Set<string> | null = null;
      if (!topicId && chapterId) {
        const { data: topicRows } = await supabase
          .from("subject_topics")
          .select("id")
          .eq("chapter_id", chapterId);
        chapterTopicIds = new Set((topicRows || []).map((t: any) => t.id));
      }

      const filtered = rows.filter((r) => {
        const answerScope = getAnsweredQuestionScope(r);

        if (subjectId) {
          const matchesSubject =
            r.subject_id === subjectId ||
            r.test?.subject_id === subjectId ||
            (r.topic_id && subjectTopicIds?.has(r.topic_id)) ||
            (r.test?.topic_id && subjectTopicIds?.has(r.test.topic_id)) ||
            (r.chapter_id && subjectChapterIds?.has(r.chapter_id)) ||
            (r.test?.chapter_id && subjectChapterIds?.has(r.test.chapter_id)) ||
            Array.from(answerScope.topicIds).some((id) => subjectTopicIds?.has(id)) ||
            Array.from(answerScope.chapterIds).some((id) => subjectChapterIds?.has(id));

          if (!matchesSubject) return false;
        }

        if (topicId) {
          return r.topic_id === topicId || r.test?.topic_id === topicId || answerScope.topicIds.has(topicId);
        }
        if (chapterId) {
          if (r.chapter_id === chapterId || r.test?.chapter_id === chapterId) return true;
          if (answerScope.chapterIds.has(chapterId)) return true;
          if (chapterTopicIds) {
            if (r.topic_id && chapterTopicIds.has(r.topic_id)) return true;
            if (r.test?.topic_id && chapterTopicIds.has(r.test.topic_id)) return true;
            if (Array.from(answerScope.topicIds).some((id) => chapterTopicIds?.has(id))) return true;
          }
          return false;
        }
        return true;
      });

      return filtered as TestResult[];
    },
  });
};

export const useSubmitTestResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: {
      test_id: string | null;
      subject_id: string | null;
      topic_id?: string | null;
      chapter_id?: string | null;
      test_type: string;
      score: number | null;
      total_questions: number;
      percentage: number | null;
      time_taken_seconds: number | null;
      answers: Record<string, string>;
      grading_status: "pending" | "graded" | "ai_graded";
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("test_results")
        .insert({
          ...result,
          student_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshLearningResults(queryClient);
      toast({ 
        title: "Test Submitted", 
        description: "Your answers have been saved. View results in the My Results tab." 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: "Failed to save test results: " + error.message, 
        variant: "destructive" 
      });
    },
  });
};

export const useUpdateTestResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<TestResult>;
    }) => {
      const { data, error } = await supabase
        .from("test_results")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshLearningResults(queryClient);
    },
    onError: (error: Error) => {
      console.error("Failed to update test result:", error);
    },
  });
};
