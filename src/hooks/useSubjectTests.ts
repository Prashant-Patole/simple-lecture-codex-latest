import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface SubjectTest {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  duration_minutes: number;
  total_marks: number;
  test_type: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  chapter?: { id: string; title: string } | null;
  topic?: { id: string; title: string } | null;
  question_count?: number;
}

export const useSubjectTests = (subjectId?: string, testTypes?: string | string[]) => {
  return useQuery({
    queryKey: ["subject-tests", subjectId, testTypes],
    queryFn: async () => {
      if (!subjectId) return [];
      
      let query = supabase
        .from("tests")
        .select(`
          *,
          chapter:subject_chapters!chapter_id(id, title),
          topic:subject_topics!topic_id(id, title)
        `)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });
      
      if (testTypes) {
        if (Array.isArray(testTypes)) {
          query = query.in("test_type", testTypes);
        } else {
          query = query.eq("test_type", testTypes);
        }
      }
      
      // OPTIMIZED: Single query with count subquery instead of N+1
      query = query.select(`
        *,
        chapter:subject_chapters!chapter_id(id, title),
        topic:subject_topics!topic_id(id, title),
        question_count:test_questions(count)
      `);
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Flatten the count subquery result
      return (data || []).map((test: any) => ({
        ...test,
        question_count: test.question_count?.[0]?.count || 0
      })) as SubjectTest[];
    },
    enabled: !!subjectId,
  });
};

export const useDeleteTest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase
        .from("tests")
        .delete()
        .eq("id", testId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-tests"] });
      toast({ title: "Test deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete test",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
