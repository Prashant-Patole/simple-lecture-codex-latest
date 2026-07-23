import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const PYQ_PAGE_SIZE = 10;

export interface PYQQuestion {
  id: string;
  subject_id: string;
  chapter_id?: string | null;
  topic_id?: string | null;
  pyq_type: "consolidated" | "important" | "predictive";
  question_text: string;
  question_format: "mcq" | "subjective" | "true_false";
  options?: Record<string, any> | null;
  marks: number;
  difficulty: "Low" | "Medium" | "Intermediate" | "Advanced";
  question_image_url?: string | null;
  is_verified: boolean;
  created_at: string;
}

export const usePYQQuestions = (
  subjectId?: string,
  pyqType?: string,
  chapterId?: string,
  topicId?: string
) => {
  return useQuery({
    queryKey: ["pyq-questions", subjectId, pyqType, chapterId, topicId],
    queryFn: async () => {
      let query = supabase
        .from("pyq_questions" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (subjectId) query = query.eq("subject_id", subjectId);
      if (pyqType) query = query.eq("pyq_type", pyqType);
      if (chapterId) query = query.eq("chapter_id", chapterId);
      if (topicId) query = query.eq("topic_id", topicId);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PYQQuestion[];
    },
    enabled: !!subjectId,
  });
};

export const usePYQQuestionsPaginated = (
  subjectId?: string,
  pyqType?: string,
  chapterId?: string,
  topicId?: string
) => {
  return useInfiniteQuery({
    queryKey: ["pyq-questions-paginated", subjectId, pyqType, chapterId, topicId],
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PYQ_PAGE_SIZE;
      const to = from + PYQ_PAGE_SIZE - 1;

      let query = supabase
        .from("pyq_questions" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (subjectId) query = query.eq("subject_id", subjectId);
      if (pyqType) query = query.eq("pyq_type", pyqType);
      if (chapterId) query = query.eq("chapter_id", chapterId);
      if (topicId) query = query.eq("topic_id", topicId);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        questions: (data as unknown as PYQQuestion[]) || [],
        totalCount: count || 0,
        nextPage: ((data?.length || 0) === PYQ_PAGE_SIZE) ? (pageParam as number) + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!subjectId,
  });
};

export const usePYQQuestionsPage = (
  subjectId?: string,
  pyqType?: string,
  chapterId?: string,
  topicId?: string,
  page: number = 1,
) => {
  return useQuery({
    queryKey: ["pyq-questions-page", subjectId, pyqType, chapterId, topicId, page],
    queryFn: async () => {
      const from = (page - 1) * PYQ_PAGE_SIZE;
      const to = from + PYQ_PAGE_SIZE - 1;

      let query = supabase
        .from("pyq_questions" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (subjectId) query = query.eq("subject_id", subjectId);
      if (pyqType) query = query.eq("pyq_type", pyqType);
      if (chapterId) query = query.eq("chapter_id", chapterId);
      if (topicId) query = query.eq("topic_id", topicId);

      const { data, error, count } = await query;
      if (error) throw error;
      const totalCount = count || 0;
      return {
        questions: (data as unknown as PYQQuestion[]) || [],
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / PYQ_PAGE_SIZE)),
      };
    },
    enabled: !!subjectId,
  });
};

export const useCreatePYQQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (question: Omit<PYQQuestion, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("pyq_questions" as any)
        .insert(question as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyq-questions"] });
      toast({ title: "Success", description: "PYQ question created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdatePYQQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PYQQuestion> }) => {
      const { data, error } = await supabase
        .from("pyq_questions" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyq-questions"] });
      toast({ title: "Success", description: "PYQ question updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeletePYQQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pyq_questions" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyq-questions"] });
      toast({ title: "Success", description: "PYQ question deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
