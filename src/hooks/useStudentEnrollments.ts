import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAuthUser } from './useCurrentAuthUser';

export interface StudentEnrollment {
  course_id: string;
  batch_id: string | null;
  enrolled_at: string | null;
}

export const useStudentEnrollments = () => {
  const { data: user } = useCurrentAuthUser();

  return useQuery({
    queryKey: ['student-enrollments', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('enrollments')
        .select('course_id, batch_id, enrolled_at')
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - enrollments don't change often
  });
};

// Helper hook to get just course IDs
export const useStudentCourseIds = () => {
  const { data: enrollments, isLoading, error } = useStudentEnrollments();
  
  return {
    courseIds: enrollments?.map(e => e.course_id) || [],
    enrollments,
    isLoading,
    error,
  };
};
