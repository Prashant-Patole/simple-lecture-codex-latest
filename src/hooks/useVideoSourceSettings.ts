import { useVideoStreamSettings, PrimaryVideoSource } from './useVideoStreamSettings';

export interface VideoSourceSettings {
  primarySource: PrimaryVideoSource;
  localServerIp: string;
  languageAvatarServerIp: string;
  languageFallback: 'vimeo' | 'local_server';
  vimeoFallback: 'local_server' | 'none';
  localServerFallback: 'vimeo' | 'none';
  fallbackServerIp: string;
  cdnBaseUrl: string;
  cdnFallback: 'local_server' | 'vimeo' | 'none';
  isLoading: boolean;
}

/**
 * Simplified hook for the player to access video source settings.
 * Returns the primary video source selection and related configuration.
 */
export const useVideoSourceSettings = (): VideoSourceSettings => {
  const { data: settings, isLoading } = useVideoStreamSettings();
  
  return {
    primarySource: settings?.primary_video_source || 'cdn_server',
    localServerIp: settings?.local_server_ip || '69.197.145.4',
    languageAvatarServerIp: settings?.language_avatar_server_ip || '69.197.145.4',
    languageFallback: settings?.language_fallback || 'vimeo',
    vimeoFallback: settings?.vimeo_fallback || 'local_server',
    localServerFallback: settings?.local_server_fallback || 'vimeo',
    fallbackServerIp: settings?.fallback_server_ip || '69.197.145.4',
    cdnBaseUrl: settings?.cdn_base_url || 'https://server1.simplelecture.com/video',
    cdnFallback: settings?.cdn_fallback || 'local_server',
    isLoading,
  };
};

// Re-export types for convenience
export type { PrimaryVideoSource };
