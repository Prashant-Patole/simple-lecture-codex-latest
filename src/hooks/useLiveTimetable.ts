import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, startOfDay, format, setHours, setMinutes, setSeconds } from 'date-fns';

export interface TimetableClass {
  id: string;
  subject_name: string;
  instructor_name: string | null;
  instructor_avatar: string | null;
  course_name: string;
  batch_name: string | null;
  room_number: string | null;
  start_time: string;
  end_time: string;
  day_of_week: number;
  scheduled_date: Date;
  scheduled_at: Date;
  ends_at: Date;
  meeting_link: string | null;
  is_live: boolean;
  is_upcoming: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert time string (HH:MM:SS) to Date object for a given date
const timeToDate = (dateBase: Date, timeStr: string): Date => {
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  let result = setHours(dateBase, hours);
  result = setMinutes(result, minutes);
  result = setSeconds(result, seconds);
  return result;
};

// Get all occurrences for a timetable entry within the next N days
const getOccurrences = (entry: any, daysAhead: number = 7): Date[] => {
  const today = startOfDay(new Date());
  const occurrences: Date[] = [];
  
  for (let i = 0; i < daysAhead; i++) {
    const checkDate = addDays(today, i);
    if (checkDate.getDay() === entry.day_of_week) {
      occurrences.push(checkDate);
    }
  }
  
  return occurrences;
};

export const useLiveTimetable = () => {
  return useQuery({
    queryKey: ['live-timetable'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { today: [], week: [], current: null, next: null };

      // Get enrolled course IDs
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, batch_id')
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (!enrollments || enrollments.length === 0) {
        return { today: [], week: [], current: null, next: null };
      }

      const courseIds = enrollments.map(e => e.course_id);

      // Fetch timetable entries for enrolled courses
      const { data: timetableEntries, error } = await supabase
        .from('course_timetables')
        .select(`
          *,
          subject:popular_subjects(id, name),
          instructor:teacher_profiles(id, full_name, avatar_url),
          course:courses(id, name),
          batch:batches(id, name),
          meeting_link
        `)
        .in('course_id', courseIds)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      if (!timetableEntries || timetableEntries.length === 0) {
        return { today: [], week: [], current: null, next: null };
      }

      const now = new Date();
      const allClasses: TimetableClass[] = [];

      // Convert timetable entries to scheduled classes for the next 7 days
      for (const entry of timetableEntries) {
        const occurrences = getOccurrences(entry, 7);
        
        for (const occurrence of occurrences) {
          const scheduled_at = timeToDate(occurrence, entry.start_time);
          const ends_at = timeToDate(occurrence, entry.end_time);
          
          const is_live = now >= scheduled_at && now <= ends_at;
          const is_upcoming = scheduled_at > now;

          allClasses.push({
            id: `${entry.id}-${format(occurrence, 'yyyy-MM-dd')}`,
            subject_name: entry.subject?.name || 'Unknown Subject',
            instructor_name: entry.instructor?.full_name || null,
            instructor_avatar: entry.instructor?.avatar_url || null,
            course_name: entry.course?.name || 'Unknown Course',
            batch_name: entry.batch?.name || null,
            room_number: entry.room_number,
            start_time: entry.start_time,
            end_time: entry.end_time,
            day_of_week: entry.day_of_week,
            scheduled_date: occurrence,
            scheduled_at,
            ends_at,
            meeting_link: entry.meeting_link || null, // Use the recurring meeting link from timetable
            is_live,
            is_upcoming,
          });
        }
      }

      // Sort by scheduled_at
      allClasses.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());

      // Filter today's classes
      const today = startOfDay(now);
      const todayClasses = allClasses.filter(c => 
        startOfDay(c.scheduled_date).getTime() === today.getTime()
      );

      // Find current live class
      const current = allClasses.find(c => c.is_live) || null;

      // Find next upcoming class
      const next = allClasses.find(c => c.is_upcoming && !c.is_live) || null;

      return {
        today: todayClasses,
        week: allClasses,
        current,
        next,
      };
    },
    refetchInterval: 60000, // Refresh every minute to update live status
  });
};

export { DAYS };
