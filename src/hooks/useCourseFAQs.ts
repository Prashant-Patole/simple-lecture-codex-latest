import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCourseFAQs = (courseId?: string) => {
  return useQuery({
    queryKey: ["course-faqs", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      
      const { data, error } = await supabase
        .from("course_faqs")
        .select("*")
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

export const useCreateCourseFAQ = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (faqData: { 
      course_id: string; 
      question: string; 
      answer: string; 
      display_order: number;
    }) => {
      const { data, error } = await supabase
        .from("course_faqs")
        .insert(faqData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-faqs", data.course_id] });
      toast({ title: "Success", description: "FAQ added successfully" });
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

export const useUpdateCourseFAQ = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, courseId, ...faqData }: any) => {
      const { data, error } = await supabase
        .from("course_faqs")
        .update(faqData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-faqs", data.courseId] });
      toast({ title: "Success", description: "FAQ updated successfully" });
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

export const useDeleteCourseFAQ = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, courseId }: { id: string; courseId: string }) => {
      const { error } = await supabase
        .from("course_faqs")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return { courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-faqs", data.courseId] });
      toast({ title: "Success", description: "FAQ deleted successfully" });
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