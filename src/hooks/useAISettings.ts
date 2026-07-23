import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AISettings {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  questions_per_topic: number;
  difficulty_distribution: {
    easy: number;
    medium: number;
    hard: number;
  };
}

const DEFAULT_AI_SETTINGS: AISettings = {
  model: "google/gemini-2.5-flash",
  temperature: 0.7,
  max_tokens: 2000,
  system_prompt: "You are an expert educational content creator specializing in generating high-quality multiple-choice questions for Indian board exams and competitive exams like NEET and JEE.",
  questions_per_topic: 10,
  difficulty_distribution: {
    easy: 30,
    medium: 50,
    hard: 20,
  },
};

export const useAISettings = () => {
  return useQuery({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("setting_key", "question_generation")
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return DEFAULT_AI_SETTINGS;
      }

      return data.setting_value as unknown as AISettings;
    },
  });
};

export const useUpdateAISettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: AISettings) => {
      const { data: existing } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("setting_key", "question_generation")
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("ai_settings")
          .update({
            setting_value: settings as any,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "question_generation")
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("ai_settings")
          .insert([{
            setting_key: "question_generation",
            setting_value: settings as any,
            description: "AI configuration for automatic question generation",
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      toast({
        title: "Success",
        description: "AI settings updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
