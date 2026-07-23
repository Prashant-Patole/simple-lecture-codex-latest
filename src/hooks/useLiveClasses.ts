import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useLiveClasses = () => {
  const { data: liveClasses, isLoading } = useQuery({
    queryKey: ['live-classes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get enrolled course IDs
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (!enrollments || enrollments.length === 0) return [];
      
      const courseIds = enrollments.map(e => e.course_id);

      const now = new Date();

      // Fetch classes that are marked as live OR currently happening based on time
      const { data } = await supabase
        .from('scheduled_classes')
        .select(`
          *,
          teacher:teacher_profiles(full_name, avatar_url)
        `)
        .in('course_id', courseIds)
        .eq('is_cancelled', false)
        .order('scheduled_at', { ascending: true });

      // Filter for live classes (either marked as live or within time range)
      const live = data?.filter(c => {
        if (c.is_live) return true;
        
        const start = new Date(c.scheduled_at);
        const end = new Date(start.getTime() + (c.duration_minutes || 60) * 60000);
        return now >= start && now <= end;
      }) || [];

      return live;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    liveClasses: liveClasses || [],
    hasLiveClasses: (liveClasses?.length || 0) > 0,
    isLoading,
  };
};
