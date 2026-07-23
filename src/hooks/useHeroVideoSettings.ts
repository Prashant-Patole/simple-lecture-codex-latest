import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface HeroVideoSettings {
  enabled: boolean;
  youtube_url: string;
}

export const DEFAULT_HERO_VIDEO_SETTINGS: HeroVideoSettings = {
  enabled: false,
  youtube_url: "",
};

export const useHeroVideoSettings = () => {
  return useQuery({
    queryKey: ["hero-video-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("setting_key", "hero_video")
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_HERO_VIDEO_SETTINGS;
      return data.setting_value as unknown as HeroVideoSettings;
    },
  });
};

export const useUpdateHeroVideoSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: HeroVideoSettings) => {
      // First check if the setting exists
      const { data: existing } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("setting_key", "hero_video")
        .maybeSingle();

      const settingValue = settings as unknown as Json;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("ai_settings")
          .update({
            setting_value: settingValue,
            description: "Homepage hero section promotional video configuration",
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "hero_video");
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("ai_settings")
          .insert({
            setting_key: "hero_video",
            setting_value: settingValue,
            description: "Homepage hero section promotional video configuration",
          });
        if (error) throw error;
      }

      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-video-settings"] });
      toast({
        title: "Settings saved",
        description: "Hero video settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save hero video settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
