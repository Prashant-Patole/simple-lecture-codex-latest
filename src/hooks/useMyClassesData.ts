import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ClassAttendance {
  id: string;
  status: string;
  duration_seconds: number | null;
  marked_at: string | null;
  subject: string;
  chapter_title: string | null;
  topic_title: string | null;
  scheduled_at: string;
  duration_minutes: number;
  course_name: string | null;
}

interface MyClassesData {
  totalScheduled: number;
  totalAttended: number;
  attendanceRate: number;
  totalTimeMinutes: number;
  aiLectureTimeMinutes: number;
  recentClasses: ClassAttendance[];
  presentCount: number;
  absentCount: number;
}

export const useMyClassesData = (studentId?: string) => {
  return useQuery({
    queryKey: ['my-classes-data', studentId],
    queryFn: async (): Promise<MyClassesData> => {
      if (!studentId) {
        return {
          totalScheduled: 0,
          totalAttended: 0,
          attendanceRate: 0,
          totalTimeMinutes: 0,
          aiLectureTimeMinutes: 0,
          recentClasses: [],
          presentCount: 0,
          absentCount: 0,
        };
      }

      // Step 1: Get enrolled course IDs
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentId)
        .eq('is_active', true);

      const courseIds = enrollments?.map(e => e.course_id) || [];

      // Step 2: Get TOTAL scheduled classes from scheduled_classes table (only past classes)
      let totalScheduled = 0;
      if (courseIds.length > 0) {
        const { count } = await supabase
          .from('scheduled_classes')
          .select('id', { count: 'exact', head: true })
          .in('course_id', courseIds)
          .eq('is_cancelled', false)
          .lte('scheduled_at', new Date().toISOString());
        
        totalScheduled = count || 0;
      }

      // Step 3: Get attendance records for this student
      const { data, error } = await supabase
        .from('class_attendance')
        .select(`
          id,
          status,
          duration_seconds,
          marked_at,
          joined_at,
          scheduled_classes!inner (
            subject,
            scheduled_at,
            duration_minutes,
            chapter:subject_chapters (
              title
            ),
            topic:subject_topics (
              title
            ),
            courses (
              name
            )
          )
        `)
        .eq('student_id', studentId)
        .order('marked_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching class attendance:', error);
        throw error;
      }

      // Fetch AI video watch logs for total AI lecture time
      const { data: videoLogs } = await supabase
        .from('ai_video_watch_logs')
        .select('watched_seconds')
        .eq('student_id', studentId);

      const aiLectureTimeMinutes = Math.round(
        (videoLogs || []).reduce((sum, log) => sum + (log.watched_seconds || 0), 0) / 60
      );

      const classes: ClassAttendance[] = (data || []).map((item: any) => ({
        id: item.id,
        status: item.status || 'absent',
        duration_seconds: item.duration_seconds,
        marked_at: item.marked_at || item.joined_at,
        subject: item.scheduled_classes?.subject || 'Unknown',
        chapter_title: item.scheduled_classes?.chapter?.title || null,
        topic_title: item.scheduled_classes?.topic?.title || null,
        scheduled_at: item.scheduled_classes?.scheduled_at || '',
        duration_minutes: item.scheduled_classes?.duration_minutes || 0,
        course_name: item.scheduled_classes?.courses?.name || null,
      }));

      // Calculate from correct sources
      const presentClasses = classes.filter(c => c.status === 'present');
      const totalAttended = presentClasses.length;
      const absentCount = totalScheduled - totalAttended;
      const attendanceRate = totalScheduled > 0 ? Math.round((totalAttended / totalScheduled) * 100) : 0;
      
      // Sum time for present classes
      const totalTimeMinutes = Math.round(
        presentClasses.reduce((acc, c) => acc + (c.duration_seconds || 0), 0) / 60
      );

      return {
        totalScheduled,
        totalAttended,
        attendanceRate,
        totalTimeMinutes,
        aiLectureTimeMinutes,
        recentClasses: classes.slice(0, 5),
        presentCount: totalAttended,
        absentCount,
      };
    },
    enabled: !!studentId,
  });
};
