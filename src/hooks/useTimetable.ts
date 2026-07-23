import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export type DayFilter = 'today' | 'tomorrow' | 'week';

export const useTimetable = (dayFilter: DayFilter = 'today') => {
  const { data: classes, isLoading } = useQuery({
    queryKey: ['timetable', dayFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get enrolled course IDs
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (!enrollments || enrollments.length === 0) return [];
      
      const courseIds = enrollments.map(e => e.course_id);

      // Calculate date range based on filter
      const now = new Date();
      let startDate, endDate;
      
      if (dayFilter === 'today') {
        startDate = startOfDay(now);
        endDate = endOfDay(now);
      } else if (dayFilter === 'tomorrow') {
        const tomorrow = addDays(now, 1);
        startDate = startOfDay(tomorrow);
        endDate = endOfDay(tomorrow);
      } else {
        startDate = startOfDay(now);
        endDate = endOfDay(addDays(now, 6));
      }

      // Fetch scheduled classes
      const { data } = await supabase
        .from('scheduled_classes')
        .select(`
          *,
          teacher:teacher_profiles(full_name, avatar_url)
        `)
        .in('course_id', courseIds)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .eq('is_cancelled', false)
        .order('scheduled_at', { ascending: true });

      return data || [];
    },
  });

  // Find current/next class
  const now = new Date();
  const currentClass = classes?.find(c => {
    const start = new Date(c.scheduled_at);
    const end = new Date(start.getTime() + (c.duration_minutes || 60) * 60000);
    return now >= start && now <= end;
  });

  const nextClass = classes?.find(c => new Date(c.scheduled_at) > now);

  return {
    classes: classes || [],
    currentClass,
    nextClass,
    isLoading,
  };
};
