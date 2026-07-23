import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  subject_id: string | null;
  is_general: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  post_count?: number;
}

export function useForumCategories() {
  return useQuery({
    queryKey: ['forum-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Get post counts for each category
      const categoriesWithCounts = await Promise.all(
        (data || []).map(async (category) => {
          const { count } = await supabase
            .from('forum_posts')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id)
            .eq('status', 'published');

          return {
            ...category,
            post_count: count || 0,
          };
        })
      );

      return categoriesWithCounts as ForumCategory[];
    },
  });
}
