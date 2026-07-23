import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Assignment {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  course_id: string | null;
  title: string;
  description: string | null;
  questions: any;
  total_marks: number | null;
  passing_marks: number | null;
  duration_minutes: number | null;
  due_date: string | null;
  valid_until: string | null;
  instructions: string | null;
  source_type: string | null;
  ai_generation_config: any | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface AIGenerationConfig {
  difficultyMix: {
    easy: number;
    medium: number;
    hard: number;
  };
  questionTypes: string[];
  totalMarks: number;
  durationMinutes: number;
}

export function useSubjectAssignments(subjectId: string) {
  return useQuery({
    queryKey: ["subject-assignments", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          chapter:chapter_id(id, title),
          topic:topic_id(id, title)
        `)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!subjectId,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (assignment: Partial<Assignment>) => {
      // Ensure required fields have defaults
      const payload = {
        title: assignment.title || "Untitled Assignment",
        questions: assignment.questions || [],
        ...assignment,
      };
      
      const { data, error } = await supabase
        .from("assignments")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subject-assignments", variables.subject_id] });
      toast({
        title: "Assignment Created",
        description: "The assignment has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useGenerateAIAssignment() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      subjectId,
      chapterId,
      topicId,
      config,
      instructions,
    }: {
      subjectId: string;
      chapterId: string;
      topicId?: string;
      config: AIGenerationConfig;
      instructions?: string;
    }) => {
      const { data, error, response } = await supabase.functions.invoke("ai-generate-assignment", {
        body: {
          subjectId,
          chapterId,
          topicId,
          config,
          instructions,
        },
      });

      if (error) {
        const status = response?.status;
        let serverMessage: string | undefined;

        try {
          // For non-2xx responses, Supabase gives us the raw Response in `response`
          const ct = response?.headers?.get("content-type") ?? "";
          if (response && ct.includes("application/json")) {
            const payload = await response.json();
            serverMessage = payload?.error;
          } else if (response) {
            serverMessage = await response.text();
          }
        } catch {
          // ignore parse errors
        }

        const message = serverMessage || error.message || "AI generation failed";

        if (status === 429) throw new Error(message || "Rate limit exceeded. Please try again later.");
        if (status === 402) throw new Error(message || "AI credits exhausted. Please add credits and try again.");
        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (error: any) => {
      toast({
        title: "AI Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, subjectId }: { id: string; subjectId: string }) => {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-assignments", data.subjectId] });
      toast({
        title: "Assignment Deleted",
        description: "The assignment has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
