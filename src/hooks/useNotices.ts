import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Notice {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  created_at: string;
  expires_at: string | null;
  is_read?: boolean;
}

export const useNotices = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch notices
      const { data: noticesData, error: noticesError } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (noticesError) throw noticesError;

      // Fetch read status
      const { data: readsData, error: readsError } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', user.id);

      if (readsError) throw readsError;

      const readNoticeIds = new Set(readsData?.map(r => r.notice_id) || []);

      return (noticesData || []).map(notice => ({
        ...notice,
        is_read: readNoticeIds.has(notice.id),
      }));
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (noticeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notice_reads')
        .upsert({ notice_id: noticeId, user_id: user.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const unreadNotices = notices?.filter(n => !n.is_read) || [];
      const inserts = unreadNotices.map(n => ({
        notice_id: n.id,
        user_id: user.id,
      }));

      if (inserts.length === 0) return;

      const { error } = await supabase
        .from('notice_reads')
        .upsert(inserts);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast({
        title: 'Success',
        description: 'All notices marked as read',
      });
    },
  });

  const unreadCount = notices?.filter(n => !n.is_read).length || 0;

  return {
    notices: notices || [],
    isLoading,
    unreadCount,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    isMarkingRead: markAsRead.isPending || markAllAsRead.isPending,
  };
};
