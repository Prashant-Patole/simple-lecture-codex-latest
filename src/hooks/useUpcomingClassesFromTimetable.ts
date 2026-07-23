import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, startOfDay, setHours, setMinutes, setSeconds, differenceInMinutes } from 'date-fns';

export interface UpcomingClass {
  id: string;
  subject: string;
  notes: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  room_number: string | null;
  teacher: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

// Convert time string (HH:MM:SS) to Date object for a given date
const timeToDate = (dateBase: Date, timeStr: string): Date => {
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  let result = setHours(dateBase, hours);
  result = setMinutes(result, minutes);
  result = setSeconds(result, seconds);
  return result;
};

export const useUpcomingClassesFromTimetable = () => {
  return useQuery({
    queryKey: ['upcoming-classes-timetable'],
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

      // Fetch timetable entries for enrolled courses
      const { data: timetableEntries, error } = await supabase
        .from('course_timetables')
        .select(`
          *,
          subject:popular_subjects(id, name),
          instructor:teacher_profiles(id, full_name, avatar_url),
          course:courses(id, name)
        `)
        .in('course_id', courseIds)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      if (!timetableEntries || timetableEntries.length === 0) return [];

      const now = new Date();
      const upcomingClasses: UpcomingClass[] = [];

      // Look 7 days ahead
      for (let i = 0; i < 7; i++) {
        const checkDate = addDays(startOfDay(now), i);
        const dayOfWeek = checkDate.getDay();

        // Find all timetable entries for this day
        const dayEntries = timetableEntries.filter(e => e.day_of_week === dayOfWeek);

        for (const entry of dayEntries) {
          const scheduledAt = timeToDate(checkDate, entry.start_time);
          const endsAt = timeToDate(checkDate, entry.end_time);
          
          // Only include future classes (not past ones)
          if (scheduledAt > now) {
            const durationMinutes = differenceInMinutes(endsAt, scheduledAt);

            upcomingClasses.push({
              id: `${entry.id}-${checkDate.toISOString().split('T')[0]}`,
              subject: entry.subject?.name || 'Class',
              notes: entry.course?.name || 'General Session',
              scheduled_at: scheduledAt.toISOString(),
              duration_minutes: durationMinutes,
              meeting_link: null, // Can be enhanced
              room_number: entry.room_number,
              teacher: entry.instructor ? {
                id: entry.instructor.id,
                full_name: entry.instructor.full_name,
                avatar_url: entry.instructor.avatar_url,
              } : null,
            });
          }
        }
      }

      // Sort by scheduled_at and take only next 10
      return upcomingClasses
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        .slice(0, 10);
    },
  });
};
