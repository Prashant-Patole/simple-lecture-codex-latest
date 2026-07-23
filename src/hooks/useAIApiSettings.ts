import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AIProvider = 'google' | 'openai' | 'lovable' | 'openrouter';

export interface AIApiSettings {
  enabled: boolean;
  provider: AIProvider;
  google_api_key: string;
  openai_api_key: string;
  openrouter_api_key: string;
  default_model: string;
  fallback_enabled: boolean;
}

export const DEFAULT_AI_API_SETTINGS: AIApiSettings = {
  enabled: false,
  provider: 'openrouter',
  google_api_key: '',
  openai_api_key: '',
  openrouter_api_key: '',
  default_model: 'google/gemini-2.5-flash',
  fallback_enabled: false,
};

export const GOOGLE_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
];

export const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export const OPENROUTER_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
];

export const useAIApiSettings = () => {
  return useQuery({
    queryKey: ["ai-api-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("setting_key", "ai_api_config")
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return DEFAULT_AI_API_SETTINGS;
      }

      // Merge with defaults so newer fields (openrouter_api_key) always exist
      return {
        ...DEFAULT_AI_API_SETTINGS,
        ...(data.setting_value as unknown as AIApiSettings),
      } as AIApiSettings;
    },
  });
};

export const useUpdateAIApiSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: AIApiSettings) => {
      const { data: existing } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("setting_key", "ai_api_config")
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("ai_settings")
          .update({
            setting_value: settings as any,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "ai_api_config")
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("ai_settings")
          .insert([{
            setting_key: "ai_api_config",
            setting_value: settings as any,
            description: "AI API configuration for custom API keys",
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-api-settings"] });
      toast({
        title: "Success",
        description: "AI API settings updated successfully",
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

export const useTestAIConnection = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      provider,
      apiKey,
      model,
    }: {
      provider: 'google' | 'openai' | 'openrouter';
      apiKey: string;
      model: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("test-ai-connection", {
        body: { provider, apiKey, model },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Connection Successful",
        description: "Your AI API key is valid and working!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
