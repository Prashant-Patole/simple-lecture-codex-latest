import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export type AvatarSourceType = 'language' | 'vimeo' | 'local' | 'default' | 'cdn';
export type PrimaryVideoSource = 'vimeo' | 'local_server' | 'language_priority' | 'cdn_server';

export interface FallbackServers {
  avatar: string;
  manim: string;
  wan: string;
  media: string;
}

export interface VideoStreamSettings {
  // Provider selection
  primary_provider: 'cloudflare_b2' | 'bunny' | 'both';
  
  // Cloudflare settings
  cloudflare_zone_id: string;
  cloudflare_api_token: string;
  cloudflare_account_id: string;
  cdn_hostname: string;
  
  // B2 settings (using existing B2 config)
  b2_recordings_bucket: string;
  b2_recordings_prefix: string;
  
  // Bunny.net settings (optional)
  bunny_api_key: string;
  bunny_library_id: string;
  bunny_cdn_hostname: string;
  use_bunny_for_transcoding: boolean;
  
  // Quality settings
  enable_adaptive_quality: boolean;
  available_qualities: string[];
  default_quality: string;
  
  // Network adaptation thresholds (Mbps)
  quality_thresholds: {
    '1080p': number;
    '720p': number;
    '480p': number;
    '360p': number;
  };
  
  // Offline downloads
  enable_offline_downloads: boolean;
  offline_download_expiry_days: number;
  max_downloads_per_user: number;
  allowed_offline_qualities: string[];
  
  // Auto-transfer settings
  auto_transfer_bbb_recordings: boolean;
  delete_from_bbb_after_transfer: boolean;
  
  // Security
  allowed_domains: string[];
  require_enrollment_check: boolean;
  
  // Avatar Video Source Priority
  avatar_source_priority: AvatarSourceType[];
  
  // Default server IP for video generation/playback
  default_server_ip: string;
  
  // Fallback server IPs for different content types
  fallback_servers: FallbackServers;
  
  // SIMPLIFIED: Primary video source selection
  primary_video_source: PrimaryVideoSource;
  local_server_ip: string;
  language_avatar_server_ip: string;
  
  // Fallback options for each source
  vimeo_fallback: 'local_server' | 'none';
  local_server_fallback: 'vimeo' | 'none';
  language_fallback: 'vimeo' | 'local_server';
  fallback_server_ip: string;
  
  // CDN Server settings
  cdn_base_url: string;
  cdn_fallback: 'local_server' | 'vimeo' | 'none';
}

export const DEFAULT_VIDEO_STREAM_SETTINGS: VideoStreamSettings = {
  primary_provider: 'cloudflare_b2',
  
  cloudflare_zone_id: '',
  cloudflare_api_token: '',
  cloudflare_account_id: '',
  cdn_hostname: '',
  
  b2_recordings_bucket: 'recordings',
  b2_recordings_prefix: 'class-recordings/',
  
  bunny_api_key: '',
  bunny_library_id: '',
  bunny_cdn_hostname: '',
  use_bunny_for_transcoding: false,
  
  enable_adaptive_quality: true,
  available_qualities: ['360p', '480p', '720p', '1080p'],
  default_quality: '720p',
  
  quality_thresholds: {
    '1080p': 5,
    '720p': 2.5,
    '480p': 1,
    '360p': 0.5,
  },
  
  enable_offline_downloads: true,
  offline_download_expiry_days: 30,
  max_downloads_per_user: 10,
  allowed_offline_qualities: ['480p', '720p'],
  
  auto_transfer_bbb_recordings: true,
  delete_from_bbb_after_transfer: false,
  
  allowed_domains: [],
  require_enrollment_check: true,
  
  // Avatar source priority settings
  avatar_source_priority: ['language', 'vimeo', 'local', 'default'],
  default_server_ip: '69.197.145.4',
  fallback_servers: {
    avatar: '69.197.145.4',
    manim: '69.197.145.4',
    wan: '69.197.145.4',
    media: '69.197.145.4',
  },
  
  // SIMPLIFIED: Primary video source selection
  primary_video_source: 'cdn_server' as PrimaryVideoSource,
  local_server_ip: '69.197.145.4',
  language_avatar_server_ip: '69.197.145.4',
  
  // Fallback options
  vimeo_fallback: 'local_server' as 'local_server' | 'none',
  local_server_fallback: 'vimeo' as 'vimeo' | 'none',
  language_fallback: 'vimeo' as 'vimeo' | 'local_server',
  fallback_server_ip: '69.197.145.4',
  
  // CDN Server settings
  cdn_base_url: 'https://server1.simplelecture.com/video',
  cdn_fallback: 'none' as 'local_server' | 'vimeo' | 'none',
};

export const useVideoStreamSettings = () => {
  return useQuery({
    queryKey: ['video-stream-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('setting_key', 'video_streaming')
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return DEFAULT_VIDEO_STREAM_SETTINGS;
      
      return {
        ...DEFAULT_VIDEO_STREAM_SETTINGS,
        ...(data.setting_value as Record<string, unknown>),
      } as VideoStreamSettings;
    },
  });
};

export const useUpdateVideoStreamSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: VideoStreamSettings) => {
      const { data: existing } = await supabase
        .from('ai_settings')
        .select('id')
        .eq('setting_key', 'video_streaming')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_settings')
          .update({
            setting_value: settings as unknown as Json,
            description: 'Video streaming and CDN configuration',
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'video_streaming');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_settings')
          .insert([{
            setting_key: 'video_streaming',
            setting_value: settings as unknown as Json,
            description: 'Video streaming and CDN configuration',
            updated_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      }
      
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-stream-settings'] });
      toast({
        title: 'Settings saved',
        description: 'Video streaming settings have been updated.',
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

export const useTestCloudflareConnection = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ zoneId, apiToken }: { zoneId: string; apiToken: string }) => {
      const { data, error } = await supabase.functions.invoke('streaming-api', {
        body: {
          action: 'test-cloudflare',
          zone_id: zoneId,
          api_token: apiToken,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Connection successful',
        description: 'Successfully connected to Cloudflare CDN.',
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

export const useVideoStreamConfigured = () => {
  const { data: settings, isLoading } = useVideoStreamSettings();
  
  const isConfigured = settings?.primary_provider === 'cloudflare_b2' 
    ? !!settings?.cdn_hostname
    : !!settings?.bunny_api_key && !!settings?.bunny_library_id;
  
  return {
    isConfigured,
    isLoading,
    settings,
  };
};
