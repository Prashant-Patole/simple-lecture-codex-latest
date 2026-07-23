import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mcLog } from '@/lib/debug/myCoursesLogger';

export interface EnrolledCourse {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  short_description: string | null;
  duration_months: number | null;
  price_inr: number | null;
  enrolled_at: string;
  progress: number;
  categoryId: string | null;
  categoryName: string | null;
  parentCategoryId: string | null;
  parentCategoryName: string | null;
  parentCategoryIcon: string | null;
}

interface RpcEnrolledCourse {
  course_id: string;
  course_name: string;
  course_slug: string;
  thumbnail_url: string | null;
  short_description: string | null;
  duration_months: number | null;
  enrolled_at: string;
  progress: number;
  category_id: string | null;
  category_name: string | null;
  parent_category_id: string | null;
  parent_category_name: string | null;
  parent_category_icon: string | null;
}

export const useEnrolledCoursesWithCategories = () => {
  const q = useQuery({
    queryKey: ['enrolled-courses-with-categories'],
    queryFn: async () => {
      const startedAt = performance.now();
      mcLog('useEnrolled', 'queryFn:start', { reason: 'NETWORK CALL — cache miss or stale' });
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user:', userError);
          return [];
        }
        
        if (!user) {
          console.log('No user logged in');
          return [];
        }

        console.log('Fetching enrolled courses for user:', user.id);

        const { data, error } = await supabase
          .rpc('get_enrolled_courses_with_progress', { p_student_id: user.id });

        if (error) {
          console.error('Error fetching enrolled courses:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          mcLog('useEnrolled', 'queryFn:done', { rows: 0, ms: Math.round(performance.now() - startedAt) });
          return [];
        }

        const courses: EnrolledCourse[] = (data as RpcEnrolledCourse[]).map((row) => ({
          id: row.course_id,
          name: row.course_name,
          slug: row.course_slug,
          thumbnail_url: row.thumbnail_url,
          short_description: row.short_description,
          duration_months: row.duration_months,
          price_inr: null,
          enrolled_at: row.enrolled_at,
          progress: row.progress || 0,
          categoryId: row.category_id,
          categoryName: row.category_name,
          parentCategoryId: row.parent_category_id,
          parentCategoryName: row.parent_category_name,
          parentCategoryIcon: row.parent_category_icon,
        }));

        mcLog('useEnrolled', 'queryFn:done', { rows: courses.length, ms: Math.round(performance.now() - startedAt) });
        return courses;
      } catch (error) {
        console.error('Error in useEnrolledCoursesWithCategories:', error);
        mcLog('useEnrolled', 'queryFn:error', { ms: Math.round(performance.now() - startedAt), error: String(error) });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  mcLog('useEnrolled', 'cache-state', {
    fromCache: !q.isFetching && !!q.data,
    isFetching: q.isFetching,
    isStale: q.isStale,
    ageSec: q.dataUpdatedAt ? Math.round((Date.now() - q.dataUpdatedAt) / 1000) : null,
    rows: q.data?.length ?? null,
  });

  return q;
};

// Hook to get user's enrolled course IDs for quick lookup
export const useEnrolledCourseIds = () => {
  return useQuery({
    queryKey: ['enrolled-course-ids'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return new Set<string>();

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id)
        .eq('is_active', true);

      return new Set(enrollments?.map(e => e.course_id) || []);
    },
    staleTime: 60000, // Cache for 1 minute
  });
};
