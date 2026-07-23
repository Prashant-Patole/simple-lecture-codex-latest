import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ForumReply {
  id: string;
  post_id: string;
  author_id: string | null;
  content: string;
  is_ai_generated: boolean;
  is_accepted_answer: boolean;
  upvotes: number;
  status: string;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  user_upvoted?: boolean;
}

export function useForumReplies(postId: string) {
  return useQuery({
    queryKey: ['forum-replies', postId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('forum_replies')
        .select('*')
        .eq('post_id', postId)
        .eq('status', 'published')
        .order('is_accepted_answer', { ascending: false })
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch author profiles for non-AI replies
      const authorIds = [...new Set((data || []).filter(r => r.author_id).map(r => r.author_id!))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Check if current user has upvoted each reply
      let upvotedIds = new Set<string>();
      if (user.user) {
        const { data: upvotes } = await supabase
          .from('forum_upvotes')
          .select('reply_id')
          .eq('user_id', user.user.id);
        upvotedIds = new Set(upvotes?.map(u => u.reply_id) || []);
      }

      return (data || []).map(reply => ({
        ...reply,
        author: reply.author_id ? profileMap.get(reply.author_id) || null : null,
        user_upvoted: upvotedIds.has(reply.id),
      })) as ForumReply[];
    },
    enabled: !!postId,
  });
}

export function useCreateForumReply() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('forum_replies')
        .insert({
          post_id: postId,
          author_id: user.user.id,
          content,
          status: 'published',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['forum-post', variables.postId] });
      toast({
        title: 'Success',
        description: 'Your reply has been posted!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post reply',
        variant: 'destructive',
      });
    },
  });
}

export function useToggleUpvote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ replyId, isUpvoted }: { replyId: string; isUpvoted: boolean }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      if (isUpvoted) {
        // Remove upvote
        const { error } = await supabase
          .from('forum_upvotes')
          .delete()
          .eq('reply_id', replyId)
          .eq('user_id', user.user.id);

        if (error) throw error;
      } else {
        // Add upvote
        const { error } = await supabase
          .from('forum_upvotes')
          .insert({
            reply_id: replyId,
            user_id: user.user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update vote',
        variant: 'destructive',
      });
    },
  });
}

export function useAcceptAnswer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ replyId, postId }: { replyId: string; postId: string }) => {
      // First unset any existing accepted answer
      await supabase
        .from('forum_replies')
        .update({ is_accepted_answer: false })
        .eq('post_id', postId);

      // Set new accepted answer
      const { error } = await supabase
        .from('forum_replies')
        .update({ is_accepted_answer: true })
        .eq('id', replyId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies', variables.postId] });
      toast({
        title: 'Answer Accepted',
        description: 'This answer has been marked as the accepted solution.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept answer',
        variant: 'destructive',
      });
    },
  });
}
