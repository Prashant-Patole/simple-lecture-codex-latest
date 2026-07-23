import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ContentType = "description" | "what_you_learn" | "course_includes" | "faq_answer" | "subject_description";

export const useAICourseContent = () => {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({
      type,
      context,
      prompt,
    }: {
      type: ContentType;
      context: {
        courseName?: string;
        shortDescription?: string;
        categories?: string[];
        subjects?: string[];
        question?: string;
        subjectName?: string;
        categoryName?: string;
      };
      prompt?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-generate-course-content", {
        body: { type, context, prompt },
      });

      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      toast({ 
        title: "AI Generation Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};