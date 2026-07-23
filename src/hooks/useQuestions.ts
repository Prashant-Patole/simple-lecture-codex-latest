import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const questionKeys = {
  all: ["questions"] as const,
  byTopic: (topicId: string) => [...questionKeys.all, "topic", topicId] as const,
  byChapter: (chapterId: string) => [...questionKeys.all, "chapter", chapterId] as const,
};

export const useQuestions = (topicId?: string, chapterId?: string) => {
  return useQuery({
    queryKey: topicId
      ? questionKeys.byTopic(topicId)
      : chapterId
      ? questionKeys.byChapter(chapterId)
      : questionKeys.all,
    queryFn: async () => {
      let query = supabase
        .from("questions")
        .select(`
          *,
          topic:topics(
            id,
            title,
            chapter:chapters(
              id,
              title
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (topicId) {
        query = query.eq("topic_id", topicId);
      } else if (chapterId) {
        query = query.eq("topic.chapter_id", chapterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!topicId || !!chapterId,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
};

export const useSubmitTest = (studentId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      topicId,
      chapterId,
      answers,
      score,
      totalMarks,
      timeTaken,
    }: {
      topicId: string;
      chapterId: string;
      answers: any[];
      score: number;
      totalMarks: number;
      timeTaken: number;
    }) => {
      // Submit test
      const { data: submission, error: submissionError } = await supabase
        .from("test_submissions")
        .insert({
          student_id: studentId,
          topic_id: topicId,
          chapter_id: chapterId,
          answers,
          score,
          total_marks: totalMarks,
          time_taken_seconds: timeTaken,
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Update progress
      const { error: progressError } = await supabase
        .from("student_progress")
        .upsert({
          student_id: studentId,
          topic_id: topicId,
          chapter_id: chapterId,
          score: Math.round((score / totalMarks) * 100),
          is_completed: true,
          completed_at: new Date().toISOString(),
        });

      if (progressError) throw progressError;

      return submission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-progress", studentId] });
      queryClient.invalidateQueries({ queryKey: ["progress-trends"] });
      toast({
        title: "Test Submitted",
        description: "Your answers have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit test.",
        variant: "destructive",
      });
    },
  });
};
