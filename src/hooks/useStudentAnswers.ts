import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface StudentAnswer {
  id: string;
  user_id: string;
  question_id: string;
  paper_id: string;
  answer_text?: string;
  answer_image_url?: string;
  submitted_at: string;
  created_at: string;
}

export const useStudentAnswers = (paperId: string | null) => {
  return useQuery({
    queryKey: ["student-answers", paperId],
    queryFn: async () => {
      if (!paperId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("student_answers")
        .select("*")
        .eq("paper_id", paperId)
        .eq("user_id", user.id);

      if (error) throw error;
      return data as StudentAnswer[];
    },
    enabled: !!paperId,
  });
};

export const useSubmitWrittenAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      paperId,
      answerText,
      answerImageUrl,
    }: {
      questionId: string;
      paperId: string;
      answerText?: string;
      answerImageUrl?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert - update if exists, insert if not
      const { data, error } = await supabase
        .from("student_answers")
        .upsert(
          {
            user_id: user.id,
            question_id: questionId,
            paper_id: paperId,
            answer_text: answerText,
            answer_image_url: answerImageUrl,
            submitted_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,question_id",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-answers", variables.paperId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUploadAnswerImage = () => {
  return useMutation({
    mutationFn: async ({ file, questionId }: { file: File; questionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${questionId}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("student-answers")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("student-answers")
        .getPublicUrl(filePath);

      return publicUrl;
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to upload image: " + error.message, variant: "destructive" });
    },
  });
};
