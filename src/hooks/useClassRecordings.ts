import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ClassRecording {
  id: string;
  scheduled_class_id: string;
  bbb_recording_id: string | null;
  original_filename: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  b2_original_path: string | null;
  b2_hls_360p_path: string | null;
  b2_hls_480p_path: string | null;
  b2_hls_720p_path: string | null;
  b2_hls_1080p_path: string | null;
  b2_encrypted_path: string | null;
  bunny_video_guid: string | null;
  bunny_status: string | null;
  cloudflare_zone_id: string | null;
  cdn_base_url: string | null;
  processing_status: string;
  processing_error: string | null;
  processed_at: string | null;
  available_qualities: string[];
  default_quality: string;
  created_at: string;
  updated_at: string;
  scheduled_class?: {
    id: string;
    subject: string;
    scheduled_at: string;
    course?: { id?: string; name: string };
    teacher?: { id?: string; full_name: string };
    subject_id?: string;
  };
}

export const useClassRecordings = (courseId?: string) => {
  return useQuery({
    queryKey: ['class-recordings', courseId],
    queryFn: async () => {
      let query = supabase
        .from('class_recordings')
        .select(`
          *,
          scheduled_class:scheduled_classes(
            id,
            subject,
            scheduled_at,
            course_id,
            course:courses(name)
          )
        `)
        .eq('processing_status', 'ready')
        .order('created_at', { ascending: false });

      if (courseId) {
        query = query.eq('scheduled_class.course_id', courseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform the data to match our interface
      return (data || []).map(item => ({
        ...item,
        available_qualities: Array.isArray(item.available_qualities) 
          ? item.available_qualities as string[]
          : [],
      })) as unknown as ClassRecording[];
    },
    enabled: true,
  });
};

export const useRecordingPlaybackUrl = () => {
  return useMutation({
    mutationFn: async ({ 
      recordingId, 
      quality = '720p' 
    }: { 
      recordingId: string; 
      quality?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('streaming-api', {
        body: {
          action: 'get-playback-url',
          recording_id: recordingId,
          quality,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data as {
        hlsUrl: string | null;
        directUrl?: string | null;
        quality: string;
        availableQualities: string[];
        expiresAt: number;
      };
    },
  });
};

export const useVideoWatchProgress = (recordingId?: string) => {
  return useQuery({
    queryKey: ['video-watch-progress', recordingId],
    queryFn: async () => {
      if (!recordingId) return null;
      
      const { data, error } = await supabase
        .from('video_watch_progress')
        .select('*')
        .eq('recording_id', recordingId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!recordingId,
  });
};

export const useUpdateWatchProgress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      recordingId, 
      progressSeconds, 
      progressPercent,
      completed = false,
    }: { 
      recordingId: string; 
      progressSeconds: number;
      progressPercent: number;
      completed?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('video_watch_progress')
        .upsert({
          recording_id: recordingId,
          user_id: user.id,
          progress_seconds: progressSeconds,
          progress_percent: progressPercent,
          completed,
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'recording_id,user_id',
        });

      if (error) throw error;
    },
    onSuccess: (_, { recordingId }) => {
      queryClient.invalidateQueries({ queryKey: ['video-watch-progress', recordingId] });
    },
  });
};

export const useOfflineDownloads = () => {
  return useQuery({
    queryKey: ['offline-downloads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offline_downloads')
        .select(`
          *,
          recording:class_recordings(
            id,
            original_filename,
            duration_seconds,
            scheduled_class:scheduled_classes(
              subject,
              course:courses(name)
            )
          )
        `)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useRequestOfflineDownload = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      recordingId, 
      quality,
      deviceId,
    }: { 
      recordingId: string; 
      quality: string;
      deviceId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('offline-download-api', {
        body: {
          action: 'request',
          recording_id: recordingId,
          quality,
          device_id: deviceId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-downloads'] });
      toast({
        title: 'Download started',
        description: 'Your offline download has been prepared.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Download failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useRevokeOfflineDownload = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (downloadId: string) => {
      const { error } = await supabase
        .from('offline_downloads')
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_reason: 'User requested',
        })
        .eq('id', downloadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-downloads'] });
      toast({
        title: 'Download revoked',
        description: 'The offline download has been removed.',
      });
    },
  });
};
