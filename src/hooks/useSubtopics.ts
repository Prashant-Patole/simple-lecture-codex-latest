import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Subtopic {
  id: string;
  topic_id: string;
  title: string;
  description?: string;
  sequence_order?: number;
  estimated_duration_minutes?: number;
  video_id?: string;
  video_platform?: string;
  notes_markdown?: string;
  content_markdown?: string;
  pdf_url?: string;
  content_json?: any;
  ai_generated_video_url?: string;
  ai_generated_podcast_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const useSubtopics = (topicId?: string) => {
  return useQuery({
    queryKey: ["subtopics", topicId],
    staleTime: 1000 * 60 * 5,  // 5 minutes - subtopics rarely change
    gcTime: 1000 * 60 * 30,    // 30 minutes cache
    queryFn: async () => {
      let query = supabase
        .from("subtopics")
        .select("*")
        .order("sequence_order", { ascending: true });
      
      if (topicId) {
        query = query.eq("topic_id", topicId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching subtopics:", error);
        throw error;
      }
      
      return data as Subtopic[];
    },
    enabled: !!topicId,
  });
};

export const useCreateSubtopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (subtopic: Omit<Subtopic, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("subtopics")
        .insert(subtopic)
        .select()
        .single();
      
      if (error) {
        console.error("Error creating subtopic:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtopics"] });
      toast({
        title: "Success",
        description: "Subtopic created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create subtopic",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateSubtopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Subtopic> & { id: string }) => {
      const { data, error } = await supabase
        .from("subtopics")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        console.error("Error updating subtopic:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtopics"] });
      toast({
        title: "Success",
        description: "Subtopic updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subtopic",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteSubtopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subtopics")
        .delete()
        .eq("id", id);
      
      if (error) {
        console.error("Error deleting subtopic:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtopics"] });
      toast({
        title: "Success",
        description: "Subtopic deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subtopic",
        variant: "destructive",
      });
    },
  });
};
