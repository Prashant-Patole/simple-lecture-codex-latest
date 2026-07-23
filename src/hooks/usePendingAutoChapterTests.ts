import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingAutoChapterTest {
  id: string;
  self_test_id: string;
  chapter_id: string;
  chapter_title: string | null;
  status: string;
  triggered_at: string;
  self_tests: {
    id: string;
    title: string;
    duration_minutes: number;
    total_questions: number;
    submitted_at: string | null;
  } | null;
}

export const usePendingAutoChapterTests = () => {
  return useQuery({
    queryKey: ['pending-auto-chapter-tests'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('auto_chapter_tests')
        .select('id, self_test_id, chapter_id, chapter_title, status, triggered_at, self_tests(id, title, duration_minutes, total_questions, submitted_at)')
        .eq('student_id', user.id)
        .neq('status', 'submitted')
        .order('triggered_at', { ascending: false });

      if (error) {
        console.error('[usePendingAutoChapterTests]', error);
        return [];
      }

      // Filter out rows whose linked self-test was already submitted (safety net)
      return ((data || []) as unknown as PendingAutoChapterTest[]).filter(
        (r) => !r.self_tests?.submitted_at,
      );
    },
    staleTime: 30_000,
  });
};
