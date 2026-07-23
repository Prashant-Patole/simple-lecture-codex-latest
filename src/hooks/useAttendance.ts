import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import { useCurrentAuthUser } from './useCurrentAuthUser';
import { useStudentCourseIds } from './useStudentEnrollments';

export const useAttendance = () => {
  const { data: user } = useCurrentAuthUser();
  const { courseIds, isLoading: enrollmentsLoading } = useStudentCourseIds();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['student-attendance', user?.id, courseIds],
    queryFn: async () => {
      if (!user || courseIds.length === 0) {
        return { percentage: 0, present: 0, total: 0, recent: [] };
      }

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Get scheduled classes for enrolled courses in last 30 days
      const { data: scheduledClasses } = await supabase
        .from('scheduled_classes')
        .select('id, scheduled_at')
        .in('course_id', courseIds)
        .gte('scheduled_at', thirtyDaysAgo)
        .lte('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false);

      const classIds = scheduledClasses?.map(c => c.id) || [];

      if (classIds.length === 0) {
        return { percentage: 0, present: 0, total: 0, recent: [] };
      }

      // Get attendance records
      const { data: attendance, error } = await supabase
        .from('class_attendance')
        .select('*, scheduled_class:scheduled_classes(scheduled_at, subject)')
        .eq('student_id', user.id)
        .in('scheduled_class_id', classIds);

      if (error) throw error;

      const total = classIds.length;
      const present = attendance?.filter(a => a.status === 'present').length || 0;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      // Get recent attendance (last 7 days)
      const recent = (attendance || [])
        .sort((a, b) => new Date(b.scheduled_class.scheduled_at).getTime() - new Date(a.scheduled_class.scheduled_at).getTime())
        .slice(0, 7);

      return { percentage, present, total, recent };
    },
    enabled: !!user && courseIds.length > 0,
  });

  return {
    percentage: data?.percentage || 0,
    present: data?.present || 0,
    total: data?.total || 0,
    recent: data?.recent || [],
    isLoading: enrollmentsLoading || queryLoading,
  };
};
