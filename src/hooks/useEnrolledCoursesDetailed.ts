import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useEnrolledCoursesDetailed = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['enrolled-courses-detailed'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get enrollments with course details
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (
            id,
            name,
            thumbnail_url,
            subjects
          )
        `)
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (!enrollments) return [];

      // For each course, get progress data
      const coursesWithProgress = await Promise.all(
        enrollments.map(async (enrollment) => {
          const courseId = enrollment.course_id;

          // Get chapters for this course
          const { data: chapters } = await supabase
            .from('chapters')
            .select('id, subject')
            .eq('course_id', courseId);

          const chapterIds = chapters?.map(c => c.id) || [];

          // Get student progress for these chapters
          const { data: progress } = await supabase
            .from('student_progress')
            .select('*')
            .eq('student_id', user.id)
            .in('chapter_id', chapterIds);

          // Calculate overall progress
          const totalChapters = chapters?.length || 0;
          const completedChapters = progress?.filter(p => p.is_completed).length || 0;
          const progressPercentage = totalChapters > 0 
            ? Math.round((completedChapters / totalChapters) * 100) 
            : 0;

          // Get last accessed date
          const lastAccessed = progress
            ?.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
            ?.updated_at;

          // Get subjects from course or chapters
          const subjects = enrollment.courses?.subjects || 
            [...new Set(chapters?.map(c => c.subject))];

          return {
            ...enrollment.courses,
            enrollmentId: enrollment.id,
            enrolledAt: enrollment.enrolled_at,
            progressPercentage,
            totalChapters,
            completedChapters,
            lastAccessed,
            subjects,
          };
        })
      );

      return coursesWithProgress;
    },
  });

  return {
    courses: data || [],
    isLoading,
  };
};
