import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useEnrollments = () => {
  return useQuery({
    queryKey: ['enrollments'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (
            *,
            programs (
              name,
              thumbnail_url
            )
          )
        `)
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
  });
};
