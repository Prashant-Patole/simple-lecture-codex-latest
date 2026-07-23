import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRecordAttendance = () => {
  const queryClient = useQueryClient();

  const joinClass = useMutation({
    mutationFn: async (scheduledClassId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if attendance record already exists
      const { data: existing } = await supabase
        .from('class_attendance')
        .select('id, joined_at')
        .eq('scheduled_class_id', scheduledClassId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existing?.joined_at) {
        // Already joined, just return existing record
        return existing;
      }

      const now = new Date().toISOString();

      if (existing) {
        // Update existing record with join time
        const { data, error } = await supabase
          .from('class_attendance')
          .update({
            joined_at: now,
            marked_at: now,
            status: 'present',
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Create new attendance record
      const { data, error } = await supabase
        .from('class_attendance')
        .insert({
          scheduled_class_id: scheduledClassId,
          student_id: user.id,
          status: 'present',
          joined_at: now,
          marked_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['my-classes-data'] });
      queryClient.invalidateQueries({ queryKey: ['current-student'] });
    },
    onError: (error) => {
      console.error('Failed to record attendance:', error);
    },
  });

  const leaveClass = useMutation({
    mutationFn: async (scheduledClassId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get existing attendance record
      const { data: existing } = await supabase
        .from('class_attendance')
        .select('id, joined_at')
        .eq('scheduled_class_id', scheduledClassId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (!existing) return null;

      const now = new Date();
      const joinedAt = existing.joined_at ? new Date(existing.joined_at) : now;
      const durationSeconds = Math.floor((now.getTime() - joinedAt.getTime()) / 1000);

      const { data, error } = await supabase
        .from('class_attendance')
        .update({
          left_at: now.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['my-classes-data'] });
      queryClient.invalidateQueries({ queryKey: ['current-student'] });
    },
    onError: (error) => {
      console.error('Failed to record leave time:', error);
    },
  });

  return { joinClass, leaveClass };
};
