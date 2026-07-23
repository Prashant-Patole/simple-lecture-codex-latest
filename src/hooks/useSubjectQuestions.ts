import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface SubjectQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_format: string;
  options?: Record<string, any>;
  correct_answer: string;
  explanation?: string;
  marks: number;
  difficulty: string;
  topic_id?: string;
  chapter_id?: string;
  subtopic_id?: string;
  is_verified: boolean;
  is_ai_generated: boolean;
  is_important?: boolean;
  question_image_url?: string;
  option_images?: Record<string, string>;
  contains_formula: boolean;
  formula_type?: string;
  previous_year_paper_id?: string;
  created_at: string;
}

export const useSubjectQuestions = (filters?: {
  subjectId?: string;
  categoryId?: string;
  topicId?: string;
  chapterId?: string;
  difficulty?: string;
  isVerified?: boolean;
  isAiGenerated?: boolean;
}) => {
  return useQuery({
    queryKey: ["subject-questions", filters],
    queryFn: async () => {
      const useInner = !!(filters?.subjectId || filters?.categoryId || filters?.chapterId);
      const selectStr = useInner
        ? `*,
          subject_topics!inner(
            id,
            title,
            chapter_id,
            subject_chapters!inner(
              id,
              title,
              subject_id,
              popular_subjects!inner(
                id,
                name,
                category_id,
                categories(
                  id,
                  name
                )
              )
            )
          )`
        : `*,
          subject_topics(
            id,
            title,
            chapter_id,
            subject_chapters(
              id,
              title,
              subject_id,
              popular_subjects(
                id,
                name,
                category_id,
                categories(
                  id,
                  name
                )
              )
            )
          )`;

      let query = supabase.from("questions").select(selectStr).limit(5000);

      if (filters?.subjectId) {
        query = query.eq('subject_topics.subject_chapters.subject_id', filters.subjectId);
      }

      if (filters?.categoryId) {
        query = query.eq('subject_topics.subject_chapters.popular_subjects.category_id', filters.categoryId);
      }

      if (filters?.topicId) {
        query = query.eq("topic_id", filters.topicId);
      }

      if (filters?.chapterId) {
        query = query.eq('subject_topics.chapter_id', filters.chapterId);
      }


      if (filters?.difficulty) {
        query = query.eq("difficulty", filters.difficulty);
      }

      if (filters?.isVerified !== undefined) {
        query = query.eq("is_verified", filters.isVerified);
      }

      if (filters?.isAiGenerated !== undefined) {
        query = query.eq("is_ai_generated", filters.isAiGenerated);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as SubjectQuestion[];
    },
    enabled: !!(filters?.subjectId || filters?.categoryId || filters?.topicId || filters?.chapterId),
  });
};

export const useCreateQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (question: Omit<SubjectQuestion, "id" | "created_at">) => {
      const normalizeType = (qf?: string, qt?: string) => {
        const allowed = ["mcq", "subjective", "true_false"] as const;
        if (qt && (allowed as readonly string[]).includes(qt)) return qt;
        if (qf === "true_false") return "true_false";
        if (qf === "single_choice" || qf === "multiple_choice") return "mcq";
        return "subjective";
      };

      const normalizeFormat = (qf?: string) => {
        const allowed = ["single_choice", "multiple_choice", "true_false", "subjective"];
        if (qf && allowed.includes(qf)) return qf;
        return "subjective";
      };

      const normalizeDifficulty = (d?: string) => {
        const allowed = ["Low", "Medium", "Intermediate", "Advanced"];
        if (d && allowed.includes(d)) return d;
        // Map legacy values
        if (d === "easy") return "Low";
        if (d === "medium") return "Medium";
        if (d === "hard") return "Advanced";
        return "Medium";
      };

      const payload = {
        ...question,
        question_type: normalizeType(question.question_format, question.question_type),
        question_format: normalizeFormat(question.question_format),
        difficulty: normalizeDifficulty(question.difficulty),
      };

      const { data, error } = await supabase
        .from("questions")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      toast({ title: "Success", description: "Question created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to create question: " + error.message, variant: "destructive" });
    },
  });
};

export const useUpdateQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<SubjectQuestion>;
    }) => {
      // Normalize values to match database constraints
      const normalizeType = (qf?: string, qt?: string) => {
        const allowed = ["mcq", "subjective", "true_false"] as const;
        if (qt && (allowed as readonly string[]).includes(qt)) return qt;
        if (qf === "true_false") return "true_false";
        if (qf === "single_choice" || qf === "multiple_choice") return "mcq";
        return "subjective";
      };

      const normalizeFormat = (qf?: string) => {
        const allowed = ["single_choice", "multiple_choice", "true_false", "subjective"];
        if (qf && allowed.includes(qf)) return qf;
        return qf;
      };

      const normalizeDifficulty = (d?: string) => {
        const allowed = ["Low", "Medium", "Intermediate", "Advanced"];
        if (d && allowed.includes(d)) return d;
        if (d === "easy") return "Low";
        if (d === "medium") return "Medium";
        if (d === "hard") return "Advanced";
        return d;
      };

      const normalizedUpdates = {
        ...updates,
        ...(updates.question_type || updates.question_format ? {
          question_type: normalizeType(updates.question_format, updates.question_type),
        } : {}),
        ...(updates.question_format ? {
          question_format: normalizeFormat(updates.question_format),
        } : {}),
        ...(updates.difficulty ? {
          difficulty: normalizeDifficulty(updates.difficulty),
        } : {}),
      };

      const { data, error } = await supabase
        .from("questions")
        .update(normalizedUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      toast({ title: "Success", description: "Question updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update question: " + error.message, variant: "destructive" });
    },
  });
};

export const useBulkVerifyQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("questions")
        .update({ is_verified: true })
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      toast({ title: "Success", description: `${count} questions verified successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to verify questions: " + error.message, variant: "destructive" });
    },
  });
};

export const useBulkDeleteQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("questions")
        .delete()
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      toast({ title: "Success", description: `${count} questions deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to delete questions: " + error.message, variant: "destructive" });
    },
  });
};

export const useDeleteQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      toast({ title: "Success", description: "Question deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to delete question: " + error.message, variant: "destructive" });
    },
  });
};

export const useUploadQuestionImage = () => {
  return useMutation({
    mutationFn: async ({ file, questionId }: { file: File; questionId: string }) => {
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();

      // Step 1: Upload to temp-uploads bucket
      const tempPath = `question-img-${questionId}-${timestamp}.${fileExt}`;
      const { error: tempUploadError } = await supabase.storage
        .from("temp-uploads")
        .upload(tempPath, file, { upsert: true });

      if (tempUploadError) throw tempUploadError;

      // Step 2: Call b2-upload edge function
      const b2FilePath = `question-images/${questionId}/image_${timestamp}.${fileExt}`;
      const { data, error: fnError } = await supabase.functions.invoke("b2-upload", {
        body: {
          storagePath: tempPath,
          filePath: b2FilePath,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          metadata: {
            entityType: "question_image",
          },
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      return data?.filePath || b2FilePath;
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to upload image: " + error.message, variant: "destructive" });
    },
  });
};

export const useBulkImportQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questions,
    }: {
      questions: Array<Omit<SubjectQuestion, "id" | "created_at">>;
    }) => {
      const results = { success: 0, errors: [] as string[] };

      // Process in batches of 100
      for (let i = 0; i < questions.length; i += 100) {
        const batch = questions.slice(i, i + 100);
        
        const normalizeBatchType = (qf?: string, qt?: string) => {
          const allowed = ["mcq", "subjective", "true_false"] as const;
          if (qt && (allowed as readonly string[]).includes(qt)) return qt;
          if (qf === "true_false") return "true_false";
          if (qf === "single_choice" || qf === "multiple_choice") return "mcq";
          return "subjective";
        };

        const normalizeBatchFormat = (qf?: string) => {
          const allowed = ["single_choice", "multiple_choice", "true_false", "subjective"];
          if (qf && allowed.includes(qf)) return qf;
          return "subjective";
        };

        const normalizeBatchDifficulty = (d?: string) => {
          const allowed = ["Low", "Medium", "Intermediate", "Advanced"];
          if (d && allowed.includes(d)) return d;
          if (d === "easy") return "Low";
          if (d === "medium") return "Medium";
          if (d === "hard") return "Advanced";
          return "Medium";
        };

        try {
          const normalizedBatch = batch.map((q) => ({
            ...q,
            question_type: normalizeBatchType(q.question_format, (q as any).question_type),
            question_format: normalizeBatchFormat(q.question_format),
            difficulty: normalizeBatchDifficulty(q.difficulty),
          }));

          const { error } = await supabase.from("questions").insert(normalizedBatch);
          if (error) throw error;
          results.success += normalizedBatch.length;

        } catch (error) {
          results.errors.push(
            `Batch ${Math.floor(i / 100) + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      toast({
        title: "Import Complete",
        description: `Imported ${results.success} questions` +
          (results.errors.length > 0 ? ` with ${results.errors.length} batch errors` : "")
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Bulk import failed: " + error.message, variant: "destructive" });
    },
  });
};
