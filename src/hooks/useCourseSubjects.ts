import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCourseSubjects = (courseId?: string) => {
  return useQuery({
    queryKey: ["course-subjects", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      
      const { data, error } = await supabase
        .from("course_subjects")
        .select(`
          *,
          subject:popular_subjects(*)
        `)
        .eq("course_id", courseId)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
};

export const useAddCourseSubject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ courseId, subjectId, displayOrder }: { 
      courseId: string; 
      subjectId: string; 
      displayOrder: number;
    }) => {
      const { data, error } = await supabase
        .from("course_subjects")
        .insert({ course_id: courseId, subject_id: subjectId, display_order: displayOrder })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["course-subjects", variables.courseId] });
      toast({ title: "Success", description: "Subject added to course" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};

export const useRemoveCourseSubject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, courseId }: { id: string; courseId: string }) => {
      const { error } = await supabase
        .from("course_subjects")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return { courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-subjects", data.courseId] });
      toast({ title: "Success", description: "Subject removed from course" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};

export const useUpdateCourseSubjectOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, displayOrder, courseId }: { 
      id: string; 
      displayOrder: number; 
      courseId: string;
    }) => {
      const { error } = await supabase
        .from("course_subjects")
        .update({ display_order: displayOrder })
        .eq("id", id);
      
      if (error) throw error;
      return { courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-subjects", data.courseId] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};