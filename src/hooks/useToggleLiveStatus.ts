import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ToggleLiveParams {
  scheduledClassId: string;
  isLive: boolean;
}

export const useToggleLiveStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduledClassId, isLive }: ToggleLiveParams) => {
      const updateData: Record<string, unknown> = {
        is_live: isLive,
      };

      if (isLive) {
        updateData.live_started_at = new Date().toISOString();
        updateData.live_ended_at = null;
      } else {
        updateData.live_ended_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('scheduled_classes')
        .update(updateData)
        .eq('id', scheduledClassId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-classes'] });
      toast.success(data.is_live ? 'Class is now LIVE!' : 'Class ended');
    },
    onError: (error) => {
      console.error('Failed to toggle live status:', error);
      toast.error('Failed to update class status');
    },
  });
};

// Hook to create a scheduled class entry from timetable and go live
export const useCreateAndGoLive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      timetableId: string;
      courseId: string;
      subjectId?: string;
      subjectName?: string;
      teacherId: string;
      meetingLink?: string;
      roomNumber?: string;
      durationMinutes?: number;
    }) => {
      const now = new Date();
      
      const insertData = {
        course_id: params.courseId,
        subject_id: params.subjectId || null,
        subject: params.subjectName || 'Live Class',
        teacher_id: params.teacherId,
        scheduled_at: now.toISOString(),
        duration_minutes: params.durationMinutes || 60,
        meeting_link: params.meetingLink || null,
        room_number: params.roomNumber || null,
        is_live: true,
        live_started_at: now.toISOString(),
        is_cancelled: false,
        timetable_entry_id: params.timetableId,
      };

      const { data, error } = await supabase
        .from('scheduled_classes')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-classes'] });
      toast.success('You are now LIVE!');
    },
    onError: (error) => {
      console.error('Failed to go live:', error);
      toast.error('Failed to start live class');
    },
  });
};
