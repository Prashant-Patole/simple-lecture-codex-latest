import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ForumPost {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  content: string;
  status: string;
  is_answered: boolean;
  is_pinned: boolean;
  view_count: number;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  category?: {
    name: string;
    slug: string;
    is_general: boolean;
  };
}

export function useForumPosts(categorySlug?: string) {
  return useQuery({
    queryKey: ['forum-posts', categorySlug],
    queryFn: async () => {
      // Build query to get posts with category
      let categoryId: string | null = null;
      
      if (categorySlug) {
        const { data: category } = await supabase
          .from('forum_categories')
          .select('id')
          .eq('slug', categorySlug)
          .single();
        categoryId = category?.id || null;
      }

      let query = supabase
        .from('forum_posts')
        .select(`
          *,
          category:forum_categories(name, slug, is_general)
        `)
        .eq('status', 'published')
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch author profiles separately
      const authorIds = [...new Set((data || []).map(p => p.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return (data || []).map(post => ({
        ...post,
        author: profileMap.get(post.author_id) || null,
      })) as ForumPost[];
    },
  });
}

export function useForumPost(postId: string) {
  return useQuery({
    queryKey: ['forum-post', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select(`
          *,
          category:forum_categories(name, slug, is_general)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;

      // Fetch author profile
      const { data: author } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', data.author_id)
        .single();

      // Increment view count
      await supabase
        .from('forum_posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', postId);

      return { ...data, author } as ForumPost;
    },
    enabled: !!postId,
  });
}

export function useCreateForumPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      title, 
      content 
    }: { 
      categoryId: string; 
      title: string; 
      content: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('forum_posts')
        .insert({
          category_id: categoryId,
          author_id: user.user.id,
          title,
          content,
          status: 'published',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      queryClient.invalidateQueries({ queryKey: ['forum-categories'] });
      toast({
        title: 'Success',
        description: 'Your question has been posted!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post question',
        variant: 'destructive',
      });
    },
  });
}

export function useFlagPost() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('forum_flags')
        .insert({
          post_id: postId,
          flagged_by: user.user.id,
          reason,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Report Submitted',
        description: 'Thank you for helping keep our community safe.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit report',
        variant: 'destructive',
      });
    },
  });
}
