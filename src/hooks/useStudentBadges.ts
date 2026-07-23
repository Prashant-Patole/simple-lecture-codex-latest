import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_type: 'silver' | 'bronze' | 'gold' | 'master' | 'course_complete';
  topic_id: string | null;
  chapter_id: string | null;
  subject_id: string | null;
  course_id: string | null;
  title: string;
  description: string | null;
  earned_at: string;
}

export const useStudentBadges = () => {
  return useQuery({
    queryKey: ['student-badges'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('student_badges')
        .select('*')
        .eq('student_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as StudentBadge[];
    },
  });
};

export const useBadgeSummary = () => {
  const { data: badges, ...rest } = useStudentBadges();

  const summary = {
    bronze: badges?.filter(b => b.badge_type === 'bronze').length || 0,
    silver: badges?.filter(b => b.badge_type === 'silver').length || 0,
    gold: badges?.filter(b => b.badge_type === 'gold').length || 0,
    master: badges?.filter(b => b.badge_type === 'master').length || 0,
    course_complete: badges?.filter(b => b.badge_type === 'course_complete').length || 0,
    total: badges?.length || 0,
  };

  return { badges, summary, ...rest };
};
