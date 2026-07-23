import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CourseDemoVideo {
  id: string;
  course_id: string;
  video_job_id: string;
  external_job_id: string;
  server_ip: string | null;
  document_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useCourseDemoVideo = (courseId?: string) => {
  return useQuery({
    queryKey: ["course-demo-video", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase
        .from("course_demo_videos")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data as CourseDemoVideo | null;
    },
    enabled: !!courseId,
    retry: 2,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
};

export const useDemoVideosByExternalJobIds = (externalJobIds: string[]) => {
  return useQuery({
    queryKey: ["course-demos-by-external", [...externalJobIds].sort()],
    queryFn: async () => {
      if (externalJobIds.length === 0) return [] as CourseDemoVideo[];
      const { data, error } = await supabase
        .from("course_demo_videos")
        .select("*")
        .in("external_job_id", externalJobIds);
      if (error) throw error;
      return (data || []) as CourseDemoVideo[];
    },
    enabled: externalJobIds.length > 0,
  });
};

export const useSetCourseDemoVideo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      course_id: string;
      video_job_id: string;
      external_job_id: string;
      server_ip?: string | null;
      document_name?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const created_by = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from("course_demo_videos")
        .upsert(
          {
            course_id: input.course_id,
            video_job_id: input.video_job_id,
            external_job_id: input.external_job_id,
            server_ip: input.server_ip ?? null,
            document_name: input.document_name ?? null,
            created_by,
          },
          { onConflict: "course_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as CourseDemoVideo;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["course-demo-video", data.course_id] });
      qc.invalidateQueries({ queryKey: ["course-demos-by-external"] });
      toast.success("Demo video set for course");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to set demo video");
    },
  });
};

export const useRemoveCourseDemoVideo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("course_demo_videos")
        .delete()
        .eq("course_id", courseId);
      if (error) throw error;
      return courseId;
    },
    onSuccess: (courseId) => {
      qc.invalidateQueries({ queryKey: ["course-demo-video", courseId] });
      qc.invalidateQueries({ queryKey: ["course-demos-by-external"] });
      toast.success("Demo removed");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to remove demo");
    },
  });
};
