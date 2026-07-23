import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ForumGroup {
  id: string;
  name: string;
  description: string | null;
  subject_id: string | null;
  created_by: string;
  is_private: boolean;
  max_members: number;
  member_count: number;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
  subject?: {
    name: string;
  } | null;
  is_member?: boolean;
}

async function uploadGroupAvatar(file: File, groupId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${groupId}/${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('group-avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('group-avatars')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function deleteGroupAvatar(avatarUrl: string): Promise<void> {
  // Extract path from URL
  const urlParts = avatarUrl.split('/group-avatars/');
  if (urlParts.length < 2) return;
  
  const path = urlParts[1];
  await supabase.storage.from('group-avatars').remove([path]);
}

export function useForumGroups() {
  return useQuery({
    queryKey: ['forum-groups'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('forum_groups')
        .select(`
          *,
          subject:popular_subjects(name)
        `)
        .eq('is_active', true)
        .order('member_count', { ascending: false });

      if (error) throw error;

      // Check membership for each group if user is logged in
      if (user.user) {
        const { data: memberships } = await supabase
          .from('forum_group_members')
          .select('group_id')
          .eq('user_id', user.user.id);

        const memberGroupIds = new Set(memberships?.map(m => m.group_id) || []);

        return (data || []).map(group => ({
          ...group,
          is_member: memberGroupIds.has(group.id),
        })) as ForumGroup[];
      }

      return data as ForumGroup[];
    },
  });
}

export function useCreateForumGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      name, 
      description, 
      subjectId, 
      isPrivate,
      avatarFile,
    }: { 
      name: string; 
      description?: string;
      subjectId?: string;
      isPrivate?: boolean;
      avatarFile?: File;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Create group first
      const { data: group, error: groupError } = await supabase
        .from('forum_groups')
        .insert({
          name,
          description,
          subject_id: subjectId || null,
          created_by: user.user.id,
          is_private: isPrivate || false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Upload avatar if provided
      if (avatarFile) {
        try {
          const avatarUrl = await uploadGroupAvatar(avatarFile, group.id);
          await supabase
            .from('forum_groups')
            .update({ avatar_url: avatarUrl })
            .eq('id', group.id);
        } catch (err) {
          console.error('Failed to upload avatar:', err);
        }
      }

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('forum_group_members')
        .insert({
          group_id: group.id,
          user_id: user.user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-groups'] });
      toast({
        title: 'Success',
        description: 'Discussion group created!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create group',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      groupId,
      name,
      description,
      avatarFile,
      removeAvatar,
      currentAvatarUrl,
    }: {
      groupId: string;
      name: string;
      description: string | null;
      avatarFile?: File;
      removeAvatar?: boolean;
      currentAvatarUrl?: string | null;
    }) => {
      const updates: { name: string; description: string | null; avatar_url?: string | null } = {
        name,
        description,
      };

      // Handle avatar changes
      if (removeAvatar && currentAvatarUrl) {
        await deleteGroupAvatar(currentAvatarUrl);
        updates.avatar_url = null;
      } else if (avatarFile) {
        // Delete old avatar if exists
        if (currentAvatarUrl) {
          await deleteGroupAvatar(currentAvatarUrl);
        }
        const avatarUrl = await uploadGroupAvatar(avatarFile, groupId);
        updates.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from('forum_groups')
        .update(updates)
        .eq('id', groupId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate all forum-groups queries
      queryClient.invalidateQueries({ queryKey: ['forum-groups'] });
      // Invalidate the specific group's details
      queryClient.invalidateQueries({ queryKey: ['group-details', variables.groupId] });
      // Force immediate refetch to ensure UI updates
      queryClient.refetchQueries({ queryKey: ['forum-groups'] });
      queryClient.refetchQueries({ queryKey: ['group-details', variables.groupId] });
      toast({
        title: 'Success',
        description: 'Group updated successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update group',
        variant: 'destructive',
      });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('forum_group_members')
        .insert({
          group_id: groupId,
          user_id: user.user.id,
          role: 'member',
        });

      if (error) throw error;
      // Database trigger handles member_count automatically
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-groups'] });
      toast({
        title: 'Joined!',
        description: 'You have joined the group.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join group',
        variant: 'destructive',
      });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('forum_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-groups'] });
      toast({
        title: 'Left Group',
        description: 'You have left the group.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave group',
        variant: 'destructive',
      });
    },
  });
}
