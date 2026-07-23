import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TopicContentParams {
  topicTitle: string;
  topicDescription?: string;
  chapterTitle: string;
  chapterDescription?: string;
  subjectName: string;
  categoryName: string;
  estimatedDurationMinutes: number;
}

export interface GeneratedExample {
  title: string;
  problem: string;
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GeneratedQuestion {
  type: 'mcq' | 'descriptive';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GeneratedTopicContent {
  content: string;
  examples: GeneratedExample[];
  practiceQuestions: GeneratedQuestion[];
}

export const useAITopicContent = () => {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: TopicContentParams): Promise<GeneratedTopicContent> => {
      const { data, error } = await supabase.functions.invoke("ai-generate-topic-content", {
        body: params,
      });

      if (error) throw error;
      return data as GeneratedTopicContent;
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
