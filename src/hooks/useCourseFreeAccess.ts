import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FreeAccessChapter {
  id: string;
  course_id: string;
  subject_id: string;
  chapter_id: string;
}

export interface CourseFreePreviewLimits {
  ai: number;
  doubts: number;
}

// Admin + public: fetch list of free-access rows for a course
export const useCourseFreeAccess = (courseId?: string) => {
  return useQuery({
    queryKey: ["course-free-chapters", courseId],
    enabled: !!courseId,
    retry: 2,
    queryFn: async (): Promise<FreeAccessChapter[]> => {
      const { data, error } = await supabase
        .from("course_free_access_chapters")
        .select("id, course_id, subject_id, chapter_id")
        .eq("course_id", courseId!);
      if (error) throw error;
      return (data || []) as FreeAccessChapter[];
    },
  });
};

// Fetch the per-course preview quotas (AI + Doubts)
export const useCourseFreePreviewLimits = (courseId?: string) => {
  return useQuery({
    queryKey: ["course-free-preview-limits", courseId],
    enabled: !!courseId,
    retry: 2,
    queryFn: async (): Promise<CourseFreePreviewLimits> => {
      const { data, error } = await supabase
        .from("courses")
        .select("free_preview_ai_limit, free_preview_doubts_limit")
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return {
        ai: (data as any)?.free_preview_ai_limit ?? 0,
        doubts: (data as any)?.free_preview_doubts_limit ?? 0,
      };
    },
  });
};

// Admin save: diff against existing rows + update course-level limits
export const useSaveCourseFreeAccess = (courseId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      selections: { subjectId: string; chapterId: string }[];
      limits?: CourseFreePreviewLimits;
    }) => {
      if (!courseId) throw new Error("Missing courseId");
      const { selections, limits } = input;

      const { data: existing, error: exErr } = await supabase
        .from("course_free_access_chapters")
        .select("id, chapter_id")
        .eq("course_id", courseId);
      if (exErr) throw exErr;

      const existingIds = new Set((existing || []).map((r) => r.chapter_id));
      const desiredIds = new Set(selections.map((s) => s.chapterId));

      const toInsert = selections.filter((s) => !existingIds.has(s.chapterId));
      const toDeleteChapterIds = (existing || [])
        .filter((r) => !desiredIds.has(r.chapter_id))
        .map((r) => r.chapter_id);

      if (toDeleteChapterIds.length) {
        const { error } = await supabase
          .from("course_free_access_chapters")
          .delete()
          .eq("course_id", courseId)
          .in("chapter_id", toDeleteChapterIds);
        if (error) throw error;
      }

      if (toInsert.length) {
        const { error } = await supabase
          .from("course_free_access_chapters")
          .insert(
            toInsert.map((s) => ({
              course_id: courseId,
              subject_id: s.subjectId,
              chapter_id: s.chapterId,
            })),
          );
        if (error) throw error;
      }

      if (limits) {
        const { error } = await supabase
          .from("courses")
          .update({
            free_preview_ai_limit: Math.max(0, Math.floor(limits.ai || 0)),
            free_preview_doubts_limit: Math.max(0, Math.floor(limits.doubts || 0)),
          } as any)
          .eq("id", courseId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-free-chapters", courseId] });
      qc.invalidateQueries({ queryKey: ["course-free-preview-limits", courseId] });
      qc.invalidateQueries({ queryKey: ["course-preview-meta"] });
      toast.success("Free access saved");
    },
    onError: (e: Error) => toast.error("Failed to save: " + e.message),
  });
};
