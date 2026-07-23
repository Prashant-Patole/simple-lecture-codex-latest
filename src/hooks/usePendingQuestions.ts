import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const usePendingQuestions = (filters: {
  categoryId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  subtopicId?: string;
  documentId?: string;
  llmStatus?: string;
  isApproved?: boolean;
}) => {
  return useQuery({
    queryKey: ["pending-questions", filters],
    queryFn: async () => {
      let query = supabase
        .from("parsed_questions_pending")
        .select(`
          *,
          categories(name),
          popular_subjects(name),
          subject_chapters(title),
          subject_topics(title),
          subtopics(title),
          uploaded_question_documents(file_name, file_type),
          teacher_profiles!fk_parsed_questions_pending_approved_by(full_name)
        `);

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
      }
      if (filters.chapterId) {
        query = query.eq('chapter_id', filters.chapterId);
      }
      if (filters.topicId) {
        query = query.eq('topic_id', filters.topicId);
      }
      if (filters.subtopicId) {
        query = query.eq('subtopic_id', filters.subtopicId);
      }
      if (filters.documentId) {
        query = query.eq('document_id', filters.documentId);
      }
      if (filters.llmStatus) {
        query = query.eq('llm_verification_status', filters.llmStatus);
      }
      if (filters.isApproved !== undefined) {
        query = query.eq('is_approved', filters.isApproved);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Map teacher name to approved_by_name
      return data.map(q => ({
        ...q,
        approved_by_name: (q as any).teacher_profiles?.full_name
      }));
    },
  });
};

export const useUpdateQuestionDifficulty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, difficulty }: { questionId: string; difficulty: string }) => {
      const { error } = await supabase
        .from('parsed_questions_pending')
        .update({ difficulty })
        .eq('id', questionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
  });
};

export const useUpdateQuestionComments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, comments }: { questionId: string; comments: string }) => {
      const { error } = await supabase
        .from('parsed_questions_pending')
        .update({ instructor_comments: comments })
        .eq('id', questionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
  });
};

export const useLLMVerifyQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionIds }: { questionIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke('llm-verify-questions', {
        body: { questionIds },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("LLM verification completed");
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to verify questions", { description: error.message });
    },
  });
};

export const useApproveAndTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionIds }: { questionIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke('approve-and-transfer-questions', {
        body: { questionIds },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully approved and transferred ${data.transferredCount} questions`, {
        description: `Approved by: ${data.approvedBy}\nFrom IP: ${data.approvedFrom}`
      });
      queryClient.invalidateQueries({ queryKey: ["pending-questions"] });
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to approve questions", { description: error.message });
    },
  });
};
