import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const EMPTY_STATS = {
  enrolledCourses: 0,
  totalHours: 0,
  completedChapters: 0,
  subjectProgress: {} as Record<string, { completed: number; total: number; percentage: number }>,
  courses: [] as any[],
};

export const useDashboardStats = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return EMPTY_STATS;

      // Get enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, courses(name, subjects)')
        .eq('student_id', user.id)
        .eq('is_active', true);

      const courseIds = enrollments?.map(e => e.course_id) || [];

      // Get student progress for subject-wise completion
      const { data: progress } = await supabase
        .from('student_progress')
        .select('chapter_id, is_completed, time_spent_seconds, chapters(subject)')
        .eq('student_id', user.id);

      // Calculate total study hours
      const totalSeconds = progress?.reduce((acc, p) => acc + (p.time_spent_seconds || 0), 0) || 0;
      const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

      // Calculate subject-wise progress
      const subjectProgress: Record<string, { completed: number; total: number; percentage: number }> = {};
      
      progress?.forEach(p => {
        const subject = p.chapters?.subject;
        if (!subject) return;

        if (!subjectProgress[subject]) {
          subjectProgress[subject] = { completed: 0, total: 0, percentage: 0 };
        }

        subjectProgress[subject].total++;
        if (p.is_completed) {
          subjectProgress[subject].completed++;
        }
      });

      // Calculate percentages
      Object.keys(subjectProgress).forEach(subject => {
        const stats = subjectProgress[subject];
        stats.percentage = stats.total > 0 
          ? Math.round((stats.completed / stats.total) * 100) 
          : 0;
      });

      // Get completed chapters count
      const completedChapters = progress?.filter(p => p.is_completed).length || 0;

      return {
        enrolledCourses: enrollments?.length || 0,
        totalHours,
        completedChapters,
        subjectProgress,
        courses: enrollments || [],
      };
    },
  });

  return {
    stats: data || {
      enrolledCourses: 0,
      totalHours: 0,
      completedChapters: 0,
      subjectProgress: {},
      courses: [],
    },
    isLoading,
  };
};
