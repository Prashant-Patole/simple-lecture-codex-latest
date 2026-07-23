import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TestQuestionView {
  id: string;
  test_id: string;
  question_id: string;
  order_number: number;
  marks: number;
  question: {
    id: string;
    question_text: string;
    options: Record<string, { text: string }> | null;
    correct_answer: string | null;
    explanation: string | null;
    difficulty: string | null;
    question_format: string | null;
  } | null;
}

export const useTestQuestionsView = (testId: string | null) => {
  return useQuery({
    queryKey: ["test-questions-view", testId],
    queryFn: async () => {
      if (!testId) return [];

      const { data, error } = await supabase
        .from("test_questions")
        .select(`
          id,
          test_id,
          question_id,
          order_number,
          marks,
          question:questions(
            id,
            question_text,
            options,
            correct_answer,
            explanation,
            difficulty,
            question_format
          )
        `)
        .eq("test_id", testId)
        .order("order_number", { ascending: true });

      if (error) throw error;

      return (data || []).map((item): TestQuestionView => ({
        id: item.id,
        test_id: item.test_id,
        question_id: item.question_id,
        order_number: item.order_number,
        marks: item.marks,
        question: item.question as TestQuestionView["question"],
      }));
    },
    enabled: !!testId,
  });
};
