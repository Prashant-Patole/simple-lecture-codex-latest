import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AttendanceStats {
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  totalDurationSeconds: number;
}

interface CourseAttendance extends AttendanceStats {
  courseId: string;
  courseName: string;
}

export const useAttendanceStats = (studentId?: string) => {
  return useQuery({
    queryKey: ['attendance-stats', studentId],
    queryFn: async (): Promise<{
      overall: AttendanceStats;
      byCourse: CourseAttendance[];
    }> => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = studentId || user?.id;
      if (!userId) throw new Error('Not authenticated');

      // Get all attendance records for the student
      const { data: attendanceData, error } = await supabase
        .from('class_attendance')
        .select(`
          id,
          status,
          duration_seconds,
          scheduled_class:scheduled_classes(
            id,
            course_id,
            scheduled_at,
            courses(id, name)
          )
        `)
        .eq('student_id', userId);

      if (error) throw error;

      // Get total scheduled classes for enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', userId)
        .eq('is_active', true);

      if (!enrollments || enrollments.length === 0) {
        return {
          overall: { totalClasses: 0, attendedClasses: 0, percentage: 0, totalDurationSeconds: 0 },
          byCourse: [],
        };
      }

      const courseIds = enrollments.map(e => e.course_id);

      // Get all past scheduled classes for enrolled courses
      const { data: scheduledClasses } = await supabase
        .from('scheduled_classes')
        .select('id, course_id, scheduled_at, courses(id, name)')
        .in('course_id', courseIds)
        .eq('is_cancelled', false)
        .lt('scheduled_at', new Date().toISOString());

      const totalClasses = scheduledClasses?.length || 0;
      const attendedClasses = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalDurationSeconds = attendanceData?.reduce((sum, a) => sum + (a.duration_seconds || 0), 0) || 0;

      // Calculate per-course stats
      const courseMap = new Map<string, { total: number; attended: number; duration: number; name: string }>();

      scheduledClasses?.forEach(sc => {
        const courseId = sc.course_id;
        const courseName = (sc.courses as { id: string; name: string } | null)?.name || 'Unknown';
        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, { total: 0, attended: 0, duration: 0, name: courseName });
        }
        courseMap.get(courseId)!.total++;
      });

      attendanceData?.forEach(a => {
        const courseId = (a.scheduled_class as { course_id?: string } | null)?.course_id;
        if (courseId && courseMap.has(courseId) && a.status === 'present') {
          courseMap.get(courseId)!.attended++;
          courseMap.get(courseId)!.duration += a.duration_seconds || 0;
        }
      });

      const byCourse: CourseAttendance[] = Array.from(courseMap.entries()).map(([courseId, stats]) => ({
        courseId,
        courseName: stats.name,
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        percentage: stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
        totalDurationSeconds: stats.duration,
      }));

      return {
        overall: {
          totalClasses,
          attendedClasses,
          percentage: totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0,
          totalDurationSeconds,
        },
        byCourse,
      };
    },
    enabled: true,
  });
};
