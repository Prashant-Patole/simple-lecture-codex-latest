import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAIFAQs = () => {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({
      courseName,
      shortDescription,
      detailedDescription,
      subjects,
    }: {
      courseName: string;
      shortDescription?: string;
      detailedDescription?: string;
      subjects?: Array<{ name: string; description?: string }>;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-generate-faqs", {
        body: { courseName, shortDescription, detailedDescription, subjects },
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