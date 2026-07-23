import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PastClass {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  subject_id: string | null;
  course_id: string;
  teacher_id: string | null;
  meeting_link: string | null;
  recording_url: string | null;
  recording_added_at: string | null;
  is_cancelled: boolean;
  bbb_meeting_id: string | null;
  subject?: { id: string; name: string } | null;
  course?: { id: string; name: string } | null;
  teacher?: { full_name: string; avatar_url: string | null } | null;
}

export type { PastClass };

export const usePastClasses = (options?: { withRecordingsOnly?: boolean; courseIds?: string[] }) => {
  return useQuery({
    queryKey: ['past-classes', options],
    queryFn: async (): Promise<PastClass[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get enrolled course IDs if not provided
      let courseIds = options?.courseIds;
      if (!courseIds) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', user.id)
          .eq('is_active', true);

        courseIds = enrollments?.map(e => e.course_id) || [];
      }

      if (courseIds.length === 0) return [];

      let query = supabase
        .from('scheduled_classes')
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          subject_id,
          course_id,
          teacher_id,
          meeting_link,
          recording_url,
          recording_added_at,
          is_cancelled,
          bbb_meeting_id,
          subject:popular_subjects(id, name),
          course:courses(id, name),
          teacher:teacher_profiles(full_name, avatar_url)
        `)
        .in('course_id', courseIds)
        .eq('is_cancelled', false)
        .lt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: false });

      if (options?.withRecordingsOnly) {
        query = query.not('recording_url', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as unknown as PastClass[]) || [];
    },
  });
};

// Hook for instructors to get their past classes
export const useInstructorPastClasses = () => {
  return useQuery({
    queryKey: ['instructor-past-classes'],
    queryFn: async (): Promise<PastClass[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('scheduled_classes')
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          subject_id,
          course_id,
          teacher_id,
          meeting_link,
          recording_url,
          recording_added_at,
          is_cancelled,
          bbb_meeting_id,
          subject:popular_subjects(id, name),
          course:courses(id, name),
          teacher:teacher_profiles(full_name, avatar_url)
        `)
        .eq('teacher_id', user.id)
        .eq('is_cancelled', false)
        .lt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as unknown as PastClass[]) || [];
    },
  });
};
