import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentCourseIds } from "./useStudentEnrollments";
import { startOfDay, endOfDay, addDays, isWithinInterval } from "date-fns";

export interface UnifiedClass {
  id: string;
  source: 'timetable' | 'scheduled';
  subject_name: string;
  subject_id: string | null;
  course_name: string;
  course_id: string;
  chapter_name: string | null;
  chapter_id: string | null;
  topic_name: string | null;
  topic_id: string | null;
  instructor_name: string | null;
  instructor_avatar: string | null;
  scheduled_at: Date;
  ends_at: Date;
  duration_minutes: number;
  meeting_link: string | null;
  is_live: boolean;
  is_upcoming: boolean;
  room_number: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function timeToDate(dateBase: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(dateBase);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function getOccurrences(entry: any, daysAhead: number = 7): Date[] {
  const today = new Date();
  const occurrences: Date[] = [];
  
  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(today, i);
    if (date.getDay() === entry.day_of_week) {
      occurrences.push(date);
    }
  }
  return occurrences;
}

export function useUnifiedLiveClasses() {
  const { courseIds, isLoading: coursesLoading } = useStudentCourseIds();

  return useQuery({
    queryKey: ['unified-live-classes', courseIds],
    queryFn: async () => {
      if (!courseIds || courseIds.length === 0) {
        return { today: [], week: [], current: null, next: null };
      }

      const now = new Date();
      const todayStart = startOfDay(now);
      const weekEnd = endOfDay(addDays(now, 7));

      // Fetch scheduled_classes (one-time classes)
      const { data: scheduledClasses, error: scheduledError } = await supabase
        .from('scheduled_classes')
        .select(`
          id,
          subject,
          scheduled_at,
          duration_minutes,
          meeting_link,
          is_cancelled,
          is_live,
          course_id,
          subject_id,
          chapter_id,
          topic_id,
          courses(id, name),
          popular_subjects(id, name),
          subject_chapters(id, title),
          subject_topics(id, title),
          teacher_profiles(id, full_name, avatar_url)
        `)
        .in('course_id', courseIds)
        .eq('is_cancelled', false)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString())
        .order('scheduled_at', { ascending: true });

      if (scheduledError) {
        console.error('Error fetching scheduled classes:', scheduledError);
      }

      // Fetch course_timetables (recurring classes)
      const { data: timetableEntries, error: timetableError } = await supabase
        .from('course_timetables')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          room_number,
          meeting_link,
          course_id,
          subject_id,
          courses(id, name),
          popular_subjects(id, name),
          teacher_profiles(id, full_name, avatar_url)
        `)
        .in('course_id', courseIds)
        .eq('is_active', true);

      if (timetableError) {
        console.error('Error fetching timetable:', timetableError);
      }

      const allClasses: UnifiedClass[] = [];

      // Process scheduled classes
      (scheduledClasses || []).forEach((sc: any) => {
        const scheduledAt = new Date(sc.scheduled_at);
        const endsAt = new Date(scheduledAt.getTime() + (sc.duration_minutes || 60) * 60000);
        
        const isLive = now >= scheduledAt && now <= endsAt;
        const isUpcoming = now < scheduledAt;

        allClasses.push({
          id: sc.id,
          source: 'scheduled',
          subject_name: sc.popular_subjects?.name || sc.subject || 'Scheduled Class',
          subject_id: sc.subject_id,
          course_name: sc.courses?.name || 'Unknown Course',
          course_id: sc.course_id,
          chapter_name: sc.subject_chapters?.title || null,
          chapter_id: sc.chapter_id,
          topic_name: sc.subject_topics?.title || null,
          topic_id: sc.topic_id,
          instructor_name: sc.teacher_profiles?.full_name || null,
          instructor_avatar: sc.teacher_profiles?.avatar_url || null,
          scheduled_at: scheduledAt,
          ends_at: endsAt,
          duration_minutes: sc.duration_minutes || 60,
          meeting_link: sc.meeting_link,
          is_live: isLive,
          is_upcoming: isUpcoming,
          room_number: null,
        });
      });

      // Process timetable entries (generate occurrences for the week)
      (timetableEntries || []).forEach((entry: any) => {
        const occurrences = getOccurrences(entry, 7);
        
        occurrences.forEach((date) => {
          const scheduledAt = timeToDate(date, entry.start_time);
          const endsAt = timeToDate(date, entry.end_time);
          const durationMinutes = Math.round((endsAt.getTime() - scheduledAt.getTime()) / 60000);
          
          const isLive = now >= scheduledAt && now <= endsAt;
          const isUpcoming = now < scheduledAt;

          allClasses.push({
            id: `timetable-${entry.id}-${date.toISOString().split('T')[0]}`,
            source: 'timetable',
            subject_name: entry.popular_subjects?.name || 'Class',
            subject_id: entry.subject_id,
            course_name: entry.courses?.name || 'Unknown Course',
            course_id: entry.course_id,
            chapter_name: null,
            chapter_id: null,
            topic_name: null,
            topic_id: null,
            instructor_name: entry.teacher_profiles?.full_name || null,
            instructor_avatar: entry.teacher_profiles?.avatar_url || null,
            scheduled_at: scheduledAt,
            ends_at: endsAt,
            duration_minutes: durationMinutes,
            meeting_link: entry.meeting_link,
            is_live: isLive,
            is_upcoming: isUpcoming,
            room_number: entry.room_number,
          });
        });
      });

      // Sort by scheduled time
      allClasses.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());

      // Filter for today
      const todayClasses = allClasses.filter(c => 
        isWithinInterval(c.scheduled_at, { start: todayStart, end: endOfDay(now) })
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
    enabled: !coursesLoading && courseIds.length > 0,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Hook to get filter options based on enrolled courses
export function useLiveClassFilterOptions(courseIds: string[]) {
  return useQuery({
    queryKey: ['live-class-filter-options', courseIds],
    queryFn: async () => {
      if (!courseIds || courseIds.length === 0) {
        return { courses: [], subjects: [], chapters: [] };
      }

      // Fetch courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name')
        .in('id', courseIds)
        .order('name');

      // Fetch subjects for these courses
      const { data: courseSubjects } = await supabase
        .from('course_subjects')
        .select(`
          course_id,
          subject_id,
          popular_subjects(id, name)
        `)
        .in('course_id', courseIds);

      // Fetch chapters for these subjects
      const subjectIds = [...new Set((courseSubjects || []).map(cs => cs.subject_id))];
      
      const { data: chapters } = await supabase
        .from('subject_chapters')
        .select('id, title, subject_id')
        .in('subject_id', subjectIds)
        .order('sequence_order');

      // Build unique subjects list
      const subjectsMap = new Map();
      (courseSubjects || []).forEach((cs: any) => {
        if (cs.popular_subjects && !subjectsMap.has(cs.popular_subjects.id)) {
          subjectsMap.set(cs.popular_subjects.id, {
            id: cs.popular_subjects.id,
            name: cs.popular_subjects.name,
            course_id: cs.course_id,
          });
        }
      });

      return {
        courses: courses || [],
        subjects: Array.from(subjectsMap.values()),
        chapters: chapters || [],
      };
    },
    enabled: courseIds.length > 0,
  });
}
