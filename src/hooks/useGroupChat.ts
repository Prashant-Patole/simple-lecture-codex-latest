import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'emoji' | 'sticker' | 'gif';

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  file_url: string | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  reply_to?: {
    id: string;
    content: string;
    sender?: {
      full_name: string | null;
    };
  } | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string | null;
  };
}

export interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  member_count: number;
  created_by: string;
  created_at: string;
  avatar_url: string | null;
  subject?: {
    name: string;
  } | null;
}

// Fetch group details with real-time updates
export function useGroupDetails(groupId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['group-details', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_groups')
        .select(`
          *,
          subject:popular_subjects(name)
        `)
        .eq('id', groupId)
        .single();

      if (error) throw error;
      return data as GroupDetails;
    },
    enabled: !!groupId,
  });

  // Set up real-time subscription for group details (member count updates)
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-details-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'forum_groups',
          filter: `id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['group-details', groupId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  return query;
}

// Fetch group messages with real-time updates
export function useGroupMessages(groupId: string) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const query = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_group_messages')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch sender profiles
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      // Fetch reply_to messages
      const replyIds = (data || []).filter(m => m.reply_to_id).map(m => m.reply_to_id as string);
      let repliesData: { id: string; content: string; sender_id: string }[] = [];
      
      if (replyIds.length > 0) {
        const { data: fetchedReplies } = await supabase
          .from('forum_group_messages')
          .select('id, content, sender_id')
          .in('id', replyIds);
        repliesData = (fetchedReplies || []) as { id: string; content: string; sender_id: string }[];
      }
      
      const replyMap = new Map<string, { id: string; content: string; sender_id: string }>(
        repliesData.map(r => [r.id, r])
      );
      
      return (data || []).map(msg => ({
        ...msg,
        message_type: msg.message_type as MessageType,
        sender: profileMap.get(msg.sender_id) || null,
        reply_to: msg.reply_to_id ? {
          id: msg.reply_to_id,
          content: replyMap.get(msg.reply_to_id)?.content || '',
          sender: profileMap.get(replyMap.get(msg.reply_to_id)?.sender_id || '') || null,
        } : null,
      })) as GroupMessage[];
    },
    enabled: !!groupId,
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!groupId) return;

    const newChannel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forum_group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
        }
      )
      .subscribe();

    setChannel(newChannel);

    return () => {
      if (newChannel) {
        supabase.removeChannel(newChannel);
      }
    };
  }, [groupId, queryClient]);

  return query;
}

// Fetch group members
export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_group_members')
        .select('*')
        .eq('group_id', groupId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = (data || []).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return (data || []).map(m => ({
        ...m,
        role: m.role as 'admin' | 'member',
        profile: profileMap.get(m.user_id) || null,
      })) as GroupMember[];
    },
    enabled: !!groupId,
  });
}

// Check if current user is member/admin
export function useGroupMembership(groupId: string) {
  return useQuery({
    queryKey: ['group-membership', groupId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      const { data, error } = await supabase
        .from('forum_group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', user.user.id)
        .maybeSingle();

      if (error) throw error;
      return data as GroupMember | null;
    },
    enabled: !!groupId,
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      groupId,
      content,
      messageType = 'text',
      fileUrl,
      replyToId,
    }: {
      groupId: string;
      content: string;
      messageType?: MessageType;
      fileUrl?: string;
      replyToId?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('forum_group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.user.id,
          content,
          message_type: messageType,
          file_url: fileUrl || null,
          reply_to_id: replyToId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', variables.groupId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });
}

// Delete message
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ messageId, groupId }: { messageId: string; groupId: string }) => {
      const { error } = await supabase
        .from('forum_group_messages')
        .update({ is_deleted: true, content: 'This message was deleted' })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', variables.groupId] });
      toast({
        title: 'Message deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete message',
        variant: 'destructive',
      });
    },
  });
}

// Add member to group
export function useAddMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      role = 'member',
    }: {
      groupId: string;
      userId: string;
      role?: 'admin' | 'member';
    }) => {
      const { error } = await supabase
        .from('forum_group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role,
        });

      if (error) throw error;

      // Send system message
      const { data: user } = await supabase.auth.getUser();
      const { data: newMember } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      await supabase
        .from('forum_group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.user!.id,
          content: `${newMember?.full_name || 'A user'} was added to the group`,
          message_type: 'system',
        });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-members', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-messages', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-details', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['forum-groups'] });
      toast({
        title: 'Member added',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add member',
        variant: 'destructive',
      });
    },
  });
}

// Remove member from group
export function useRemoveMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      memberName,
    }: {
      groupId: string;
      userId: string;
      memberName?: string;
    }) => {
      const { error } = await supabase
        .from('forum_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      // Send system message
      const { data: user } = await supabase.auth.getUser();
      await supabase
        .from('forum_group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.user!.id,
          content: `${memberName || 'A user'} was removed from the group`,
          message_type: 'system',
        });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-members', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-messages', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-details', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['forum-groups'] });
      toast({
        title: 'Member removed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });
}

// Update member role
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      newRole,
      memberName,
    }: {
      groupId: string;
      userId: string;
      newRole: 'admin' | 'member';
      memberName?: string;
    }) => {
      const { error } = await supabase
        .from('forum_group_members')
        .update({ role: newRole })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      // Send system message
      const { data: user } = await supabase.auth.getUser();
      const action = newRole === 'admin' ? 'is now an admin' : 'is no longer an admin';
      await supabase
        .from('forum_group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.user!.id,
          content: `${memberName || 'A user'} ${action}`,
          message_type: 'system',
        });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-members', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-messages', variables.groupId] });
      toast({
        title: 'Role updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    },
  });
}

// Search users by email for adding to group
export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['search-users', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      const { data, error } = await supabase.functions.invoke('search-users-by-email', {
        body: { query },
      });

      if (error) throw error;
      return data?.users || [];
    },
    enabled: query.length >= 2,
  });
}

// Typing indicator using Supabase Presence
export function useTypingIndicator(groupId: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!groupId) return;

    const newChannel = supabase.channel(`typing-${groupId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((p: any) => p.user_name)
          .filter(Boolean);
        setTypingUsers(users);
      })
      .subscribe();

    setChannel(newChannel);

    return () => {
      if (newChannel) {
        supabase.removeChannel(newChannel);
      }
    };
  }, [groupId]);

  const setTyping = async (userName: string) => {
    if (channel) {
      await channel.track({ user_name: userName });
      // Auto-remove after 3 seconds
      setTimeout(async () => {
        await channel.untrack();
      }, 3000);
    }
  };

  return { typingUsers, setTyping };
}
