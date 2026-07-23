import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface BBBSettings {
  enabled: boolean;
  server_url: string;
  shared_secret: string;
  webhook_enabled: boolean;
  allow_recording: boolean;
  auto_start_recording: boolean;
  default_welcome_message: string;
  default_logout_url: string;
  mute_on_start: boolean;
  allow_mods_to_unmute_users: boolean;
}

export const DEFAULT_BBB_SETTINGS: BBBSettings = {
  enabled: false,
  server_url: '',
  shared_secret: '',
  webhook_enabled: true,
  allow_recording: true,
  auto_start_recording: false,
  default_welcome_message: 'Welcome to the class!',
  default_logout_url: '',
  mute_on_start: true,
  allow_mods_to_unmute_users: true,
};

export const useBBBSettings = () => {
  return useQuery({
    queryKey: ['bbb-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('setting_key', 'bigbluebutton')
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return DEFAULT_BBB_SETTINGS;
      
      return {
        ...DEFAULT_BBB_SETTINGS,
        ...(data.setting_value as Record<string, unknown>),
      } as BBBSettings;
    },
  });
};

export const useUpdateBBBSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: BBBSettings) => {
      // First check if record exists
      const { data: existing } = await supabase
        .from('ai_settings')
        .select('id')
        .eq('setting_key', 'bigbluebutton')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_settings')
          .update({
            setting_value: settings as unknown as Json,
            description: 'BigBlueButton server configuration',
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'bigbluebutton');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_settings')
          .insert([{
            setting_key: 'bigbluebutton',
            setting_value: settings as unknown as Json,
            description: 'BigBlueButton server configuration',
            updated_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      }
      
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bbb-settings'] });
      toast({
        title: 'Settings saved',
        description: 'BigBlueButton settings have been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useTestBBBConnection = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ serverUrl, sharedSecret }: { serverUrl: string; sharedSecret: string }) => {
      const { data, error } = await supabase.functions.invoke('bbb-api', {
        body: {
          action: 'test-connection',
          server_url: serverUrl,
          shared_secret: sharedSecret,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Connection successful',
        description: 'Successfully connected to BigBlueButton server.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Connection failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Check if BBB is configured
export const useBBBConfigured = () => {
  const { data: settings, isLoading } = useBBBSettings();
  
  return {
    isConfigured: settings?.enabled && !!settings?.server_url && !!settings?.shared_secret,
    isLoading,
    settings,
  };
};
