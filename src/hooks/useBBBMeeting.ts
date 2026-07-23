import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBBBConfigured } from './useBBBSettings';

interface CreateMeetingOptions {
  scheduledClassId: string;
  meetingName: string;
  welcomeMessage?: string;
  record?: boolean;
  autoStartRecording?: boolean;
}

interface JoinMeetingOptions {
  scheduledClassId: string;
  role: 'moderator' | 'attendee';
  fullName: string;
}

interface MeetingInfo {
  running: boolean;
  participantCount: number;
  moderatorCount: number;
  attendeeCount: number;
  startTime: string | null;
  recording: boolean;
}

export const useBBBMeeting = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConfigured } = useBBBConfigured();

  const createMeeting = useMutation({
    mutationFn: async (options: CreateMeetingOptions) => {
      if (!isConfigured) {
        throw new Error('BigBlueButton is not configured');
      }

      const { data, error } = await supabase.functions.invoke('bbb-api', {
        body: {
          action: 'create',
          scheduled_class_id: options.scheduledClassId,
          meeting_name: options.meetingName,
          welcome_message: options.welcomeMessage,
          record: options.record ?? true,
          auto_start_recording: options.autoStartRecording ?? false,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['bbb-meeting-info', variables.scheduledClassId] });
      toast({
        title: 'Meeting created',
        description: 'BigBlueButton meeting has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create meeting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const joinMeeting = useMutation({
    mutationFn: async (options: JoinMeetingOptions) => {
      if (!isConfigured) {
        throw new Error('BigBlueButton is not configured');
      }

      const { data, error } = await supabase.functions.invoke('bbb-api', {
        body: {
          action: 'join',
          scheduled_class_id: options.scheduledClassId,
          role: options.role,
          full_name: options.fullName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data.joinUrl as string;
    },
    onError: (error) => {
      toast({
        title: 'Failed to join meeting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const endMeeting = useMutation({
    mutationFn: async (scheduledClassId: string) => {
      if (!isConfigured) {
        throw new Error('BigBlueButton is not configured');
      }

      const { data, error } = await supabase.functions.invoke('bbb-api', {
        body: {
          action: 'end',
          scheduled_class_id: scheduledClassId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, scheduledClassId) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['bbb-meeting-info', scheduledClassId] });
      toast({
        title: 'Meeting ended',
        description: 'BigBlueButton meeting has been ended.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to end meeting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getMeetingInfo = async (scheduledClassId: string): Promise<MeetingInfo | null> => {
    if (!isConfigured) return null;

    const { data, error } = await supabase.functions.invoke('bbb-api', {
      body: {
        action: 'info',
        scheduled_class_id: scheduledClassId,
      },
    });

    if (error || data?.error) return null;

    return data as MeetingInfo;
  };

  return {
    createMeeting,
    joinMeeting,
    endMeeting,
    getMeetingInfo,
    isConfigured,
  };
};

export const useBBBMeetingInfo = (scheduledClassId: string | undefined) => {
  const { isConfigured } = useBBBConfigured();

  return useQuery({
    queryKey: ['bbb-meeting-info', scheduledClassId],
    queryFn: async () => {
      if (!scheduledClassId || !isConfigured) return null;

      const { data, error } = await supabase.functions.invoke('bbb-api', {
        body: {
          action: 'info',
          scheduled_class_id: scheduledClassId,
        },
      });

      if (error || data?.error) return null;

      return data as MeetingInfo;
    },
    enabled: !!scheduledClassId && isConfigured,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useBBBRecordings = (scheduledClassId: string | undefined) => {
  const { isConfigured } = useBBBConfigured();

  return useQuery({
    queryKey: ['bbb-recordings', scheduledClassId],
    queryFn: async () => {
      if (!scheduledClassId || !isConfigured) return [];

      const { data, error } = await supabase.functions.invoke('bbb-api', {
        body: {
          action: 'recordings',
          scheduled_class_id: scheduledClassId,
        },
      });

      if (error || data?.error) return [];

      return data.recordings || [];
    },
    enabled: !!scheduledClassId && isConfigured,
  });
};
