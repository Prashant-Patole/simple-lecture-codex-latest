import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStudentCourseIds } from './useStudentEnrollments';

export interface UpcomingClass {
  id: string;
  subject: string;
  subject_name: string | null;
  course_name: string | null;
  notes: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  is_live: boolean;
  teacher: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export const useUpcomingClasses = () => {
  const { courseIds, isLoading: enrollmentsLoading } = useStudentCourseIds();

  const { data: classes, isLoading: queryLoading } = useQuery({
    queryKey: ['upcoming-classes-dashboard', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];

      const now = new Date().toISOString();
      
      // Fetch scheduled classes with joins
      const { data: scheduledClasses, error } = await supabase
        .from('scheduled_classes')
        .select(`
          id,
          subject,
          subject_id,
          notes,
          scheduled_at,
          duration_minutes,
          meeting_link,
          is_live,
          teacher_id,
          course_id
        `)
        .in('course_id', courseIds)
        .gte('scheduled_at', now)
        .eq('is_cancelled', false)
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      if (!scheduledClasses || scheduledClasses.length === 0) return [];

      // Get unique IDs for batch fetching
      const subjectIds = [...new Set(scheduledClasses.map(c => c.subject_id).filter(Boolean))] as string[];
      const teacherIds = [...new Set(scheduledClasses.map(c => c.teacher_id).filter(Boolean))] as string[];
      const courseIdsUnique = [...new Set(scheduledClasses.map(c => c.course_id).filter(Boolean))] as string[];

      // Batch fetch related data
      const [subjectsResult, teachersResult, coursesResult] = await Promise.all([
        subjectIds.length > 0 
          ? supabase.from('popular_subjects').select('id, name').in('id', subjectIds)
          : { data: [] },
        teacherIds.length > 0
          ? supabase.from('teacher_profiles').select('id, full_name, avatar_url').in('id', teacherIds)
          : { data: [] },
        courseIdsUnique.length > 0
          ? supabase.from('courses').select('id, name').in('id', courseIdsUnique)
          : { data: [] }
      ]);

      // O(1) Map lookups instead of O(n) .find()
      const subjectMap = new Map((subjectsResult.data || []).map(s => [s.id, s.name]));
      const courseMap = new Map((coursesResult.data || []).map(c => [c.id, c.name]));
      const teacherMap = new Map((teachersResult.data || []).map(t => [t.id, t]));

      return scheduledClasses.map(classItem => ({
        id: classItem.id,
        subject: classItem.subject,
        subject_name: subjectMap.get(classItem.subject_id!) || null,
        course_name: courseMap.get(classItem.course_id!) || null,
        notes: classItem.notes,
        scheduled_at: classItem.scheduled_at,
        duration_minutes: classItem.duration_minutes,
        meeting_link: classItem.meeting_link,
        is_live: classItem.is_live || false,
        teacher: teacherMap.get(classItem.teacher_id!) || null,
      })) as UpcomingClass[];
    },
    enabled: courseIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  return {
    data: classes || [],
    isLoading: enrollmentsLoading || queryLoading,
  };
};
