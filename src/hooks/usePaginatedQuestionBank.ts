import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;

export interface QuestionBankFilters {
  categoryId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  difficulty?: string;
  questionFormat?: string;
  sourceType?: string;
  searchQuery?: string;
  isVerified?: boolean;
}

export interface QuestionBankItem {
  id: string;
  question_text: string;
  question_type: string;
  question_format: string;
  options: Record<string, any> | null;
  correct_answer: string;
  explanation: string | null;
  marks: number;
  difficulty: string;
  is_verified: boolean;
  is_ai_generated: boolean;
  is_important: boolean | null;
  contains_formula: boolean;
  topic_id: string | null;
  chapter_id: string | null;
  source_document_purpose: string | null;
  created_at: string;
}

interface QuestionBankPage {
  questions: QuestionBankItem[];
  totalCount: number;
  nextCursor: number | undefined;
}

export const usePaginatedQuestionBank = (filters: QuestionBankFilters) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["question-bank", filters],
    queryFn: async ({ pageParam = 0 }): Promise<QuestionBankPage> => {
      const { data, error } = await supabase.rpc("get_question_bank_page", {
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
        p_category_id: filters.categoryId || null,
        p_subject_id: filters.subjectId || null,
        p_chapter_id: filters.chapterId || null,
        p_topic_id: filters.topicId || null,
        p_difficulty: filters.difficulty || null,
        p_question_format: filters.questionFormat || null,
        p_source_type: filters.sourceType || null,
        p_search_query: filters.searchQuery || null,
        p_is_verified: filters.isVerified ?? null,
      });

      if (error) throw error;

      const questions = (data || []) as QuestionBankItem[];
      const totalCount = questions.length > 0 ? (questions[0] as any).total_count : 0;

      return {
        questions,
        totalCount,
        nextCursor: pageParam + PAGE_SIZE < totalCount ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 30_000, // 30 seconds
  });

  // Helper to invalidate the question bank cache after mutations
  const invalidateQuestionBank = () => {
    queryClient.invalidateQueries({ queryKey: ["question-bank"], exact: false });
  };

  return {
    ...query,
    invalidateQuestionBank,
  };
};
