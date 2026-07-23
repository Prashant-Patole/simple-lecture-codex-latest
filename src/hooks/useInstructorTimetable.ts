import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Now queries from course_timetables (unified table)
export const useInstructorTimetable = (instructorId?: string) => {
  return useQuery({
    queryKey: ['instructor-timetable', instructorId],
    queryFn: async () => {
      if (!instructorId) return [];

      const { data, error } = await supabase
        .from('course_timetables')
        .select(`
          *,
          instructor:teacher_profiles(id, full_name),
          subject:popular_subjects(id, name),
          batch:batches(id, name),
          course:courses(id, name)
        `)
        .eq('instructor_id', instructorId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      return data || [];
    },
    enabled: !!instructorId,
  });
};

export const useCreateTimetableEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      // Insert into course_timetables (unified table)
      const { error } = await supabase
        .from('course_timetables')
        .insert({
          course_id: data.course_id,
          batch_id: data.batch_id || null,
          subject_id: data.subject_id || null,
          instructor_id: data.instructor_id || null,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
          room_number: data.room_number || null,
          academic_year: data.academic_year,
          valid_from: data.valid_from,
          valid_until: data.valid_until || null,
          is_active: data.is_active ?? true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate both query keys to sync both pages
      queryClient.invalidateQueries({ queryKey: ['instructor-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['course-timetables'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-conflicts'] });
      toast.success('Timetable entry created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create timetable entry');
    },
  });
};

export const useUpdateTimetableEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('course_timetables')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['course-timetables'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-conflicts'] });
      toast.success('Timetable entry updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update timetable entry');
    },
  });
};

export const useDeleteTimetableEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('course_timetables')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['course-timetables'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-conflicts'] });
      toast.success('Timetable entry deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete timetable entry');
    },
  });
};

export const useCreateLiveClassFromTimetable = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('scheduled_classes')
        .insert(data);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
      toast.success('Live class created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create live class');
    },
  });
};
