import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TopicVideo {
  id: string;
  topic_id: string;
  video_name: string;
  language: string;
  video_platform: 'youtube' | 'vimeo' | null;
  video_id: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const INDIAN_LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi (हिन्दी)' },
  { value: 'kannada', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'tamil', label: 'Tamil (தமிழ்)' },
  { value: 'telugu', label: 'Telugu (తెలుగు)' },
  { value: 'malayalam', label: 'Malayalam (മലയാളം)' },
  { value: 'marathi', label: 'Marathi (मराठी)' },
  { value: 'bengali', label: 'Bengali (বাংলা)' },
  { value: 'gujarati', label: 'Gujarati (ગુજરાતી)' },
  { value: 'punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'odia', label: 'Odia (ଓଡ଼ିଆ)' },
  { value: 'assamese', label: 'Assamese (অসমীয়া)' },
  { value: 'urdu', label: 'Urdu (اردو)' },
];

export const useTopicVideos = (topicId?: string) => {
  return useQuery({
    queryKey: ['topic-videos', topicId],
    queryFn: async () => {
      if (!topicId) return [];
      
      const { data, error } = await supabase
        .from('topic_videos')
        .select('*')
        .eq('topic_id', topicId)
        .order('language')
        .order('display_order');

      if (error) throw error;
      return data as TopicVideo[];
    },
    enabled: !!topicId,
  });
};

export const useCreateTopicVideo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (video: Omit<TopicVideo, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('topic_videos')
        .insert(video)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['topic-videos', variables.topic_id] });
      toast({ title: "Video added successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to add video", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};

export const useUpdateTopicVideo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TopicVideo> & { id: string }) => {
      const { data, error } = await supabase
        .from('topic_videos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['topic-videos', data.topic_id] });
      toast({ title: "Video updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update video", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};

export const useDeleteTopicVideo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, topicId }: { id: string; topicId: string }) => {
      const { error } = await supabase
        .from('topic_videos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { topicId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['topic-videos', data.topicId] });
      toast({ title: "Video deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete video", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
};
