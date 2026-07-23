import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddRecordingParams {
  scheduledClassId: string;
  recordingUrl: string;
}

export const useAddRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduledClassId, recordingUrl }: AddRecordingParams) => {
      const { data, error } = await supabase
        .from('scheduled_classes')
        .update({
          recording_url: recordingUrl,
          recording_added_at: new Date().toISOString(),
        })
        .eq('id', scheduledClassId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['past-classes'] });
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast.success('Recording added successfully');
    },
    onError: (error) => {
      console.error('Failed to add recording:', error);
      toast.error('Failed to add recording');
    },
  });
};
