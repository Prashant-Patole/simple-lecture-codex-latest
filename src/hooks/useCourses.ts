import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Query key factory for better cache management
export const courseKeys = {
  all: ["courses"] as const,
  lists: () => [...courseKeys.all, "list"] as const,
  list: (filters: string) => [...courseKeys.lists(), { filters }] as const,
  details: () => [...courseKeys.all, "detail"] as const,
  detail: (id: string) => [...courseKeys.details(), id] as const,
};

export const useCourses = (category?: string) => {
  return useQuery({
    queryKey: category ? courseKeys.list(category) : courseKeys.lists(),
    queryFn: async () => {
      const query: any = supabase
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("sequence_order");
      
      const finalQuery = category ? query.eq("category", category) : query;
      const { data, error } = await finalQuery;
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
};

export const useCourse = (courseId: string) => {
  return useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          chapters(
            *,
            topics(*)
          )
        `)
        .eq("id", courseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
  });
};

export const useEnrollment = (studentId: string, courseId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ["enrollment", studentId, courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("student_id", studentId)
        .eq("course_id", courseId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!studentId && !!courseId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .insert({
          student_id: studentId,
          course_id: courseId,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment", studentId, courseId] });
      toast({
        title: "Enrolled Successfully",
        description: "You have been enrolled in the course.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enrollment Failed",
        description: error.message || "Failed to enroll in course.",
        variant: "destructive",
      });
    },
  });

  return {
    enrollment,
    isLoading,
    enroll: enroll.mutate,
    isEnrolling: enroll.isPending,
  };
};
