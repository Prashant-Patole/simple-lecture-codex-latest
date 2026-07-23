import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaperQuestionView {
  id: string;
  question_text: string;
  options: Record<string, { text: string }>;
  correct_answer: string;
  explanation?: string | null;
  difficulty: string;
  marks: number;
  is_important?: boolean;
  question_format?: string | null;
  hasValidOptions: boolean;
}

// Detect if options are placeholders (e.g., {A: {text: "None"}} or {A: {text: "A"}})
const isPlaceholderOptions = (options: Record<string, { text: string }> | null): boolean => {
  if (!options) return true;
  const entries = Object.entries(options);
  if (entries.length === 0) return true;

  // Check if all option texts are just the key itself, "None", empty, or single letters
  return entries.every(([key, val]) => {
    const text = (val?.text || "").trim().toLowerCase();
    return !text || text === "none" || text === key.toLowerCase() || text.length <= 1;
  });
};

export const usePaperQuestionsView = (paperId: string | null) => {
  return useQuery({
    queryKey: ["paper-questions-view", paperId],
    queryFn: async () => {
      if (!paperId) return [];

      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, options, correct_answer, explanation, difficulty, marks, is_important, question_format")
        .eq("previous_year_paper_id", paperId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((q): PaperQuestionView => {
        const options = q.options as Record<string, { text: string }>;
        return {
          id: q.id,
          question_text: q.question_text,
          options: options || {},
          correct_answer: q.correct_answer || "",
          explanation: q.explanation,
          difficulty: q.difficulty || "Medium",
          marks: q.marks || 1,
          is_important: q.is_important || false,
          question_format: q.question_format,
          hasValidOptions: !isPlaceholderOptions(options),
        };
      });
    },
    enabled: !!paperId,
  });
};
