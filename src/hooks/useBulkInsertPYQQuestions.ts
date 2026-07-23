import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ExtractedPYQQuestion } from "./useExtractPYQQuestionsAI";

interface BulkInsertParams {
  questions: ExtractedPYQQuestion[];
  subjectId: string;
  pyqType: "consolidated" | "important" | "predictive";
  chapterId?: string | null;
}

export function useBulkInsertPYQQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questions, subjectId, pyqType, chapterId }: BulkInsertParams) => {
      console.log("[useBulkInsertPYQQuestions] Inserting", questions.length, "questions. Subject:", subjectId, "Type:", pyqType, "Chapter:", chapterId);
      const rows = questions.map((q) => ({
        subject_id: subjectId,
        pyq_type: pyqType,
        question_text: q.question_text,
        question_format: q.question_format,
        options: q.options as any,
        marks: q.marks,
        difficulty: q.difficulty,
        chapter_id: chapterId || null,
        is_verified: false,
      }));

      const { data, error } = await supabase
        .from("pyq_questions")
        .insert(rows)
        .select("id");

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Saved ${data.length} PYQ questions.`);
      queryClient.invalidateQueries({ queryKey: ["pyq-questions", variables.subjectId] });
    },
    onError: (error: Error) => {
      console.error("Bulk insert error:", error);
      toast.error(`Failed to save: ${error.message}`);
    },
  });
}
