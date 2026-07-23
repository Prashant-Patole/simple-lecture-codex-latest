import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PopularSubject {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  content_json?: any;
  json_source_pdf_url?: string;
  thumbnail_url?: string;
  server_ip?: string;
}

// Available server options for video generation
export const VIDEO_SERVER_OPTIONS = [
  { ip: '69.197.145.4', label: 'Server 1 (Default)' },
  { ip: '63.141.249.82', label: 'Server 2' },
  { ip: '173.208.218.77', label: 'Server 3' },
  { ip: '38.247.187.26', label: 'Server 4' },
  { ip: '38.247.185.28', label: 'Server 5' },
  { ip: '38.247.187.18', label: 'Server 6' },
] as const;

// Explicit field selection - excludes large columns (thumbnail_url, content_json, json_source_pdf_url)
const LIST_SELECT_FIELDS = `
  id, name, slug, description, category_id, display_order, 
  is_active, created_at, updated_at, server_ip
`;

export const useAdminPopularSubjects = () => {
  return useQuery({
    queryKey: ["admin-popular-subjects"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select(LIST_SELECT_FIELDS)
        .order("display_order");

      if (error) throw error;
      return data as PopularSubject[];
    },
  });
};

// Lightweight version for form - excludes large columns (content_json, json_source_pdf_url, thumbnail_url)
const FORM_SELECT_FIELDS = `
  id, name, slug, description, category_id, display_order, 
  is_active, server_ip, created_at, updated_at
`;

export const useAdminSubject = (id?: string) => {
  return useQuery({
    queryKey: ["admin-subject", id],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("popular_subjects")
        .select(FORM_SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as PopularSubject;
    },
    enabled: !!id,
  });
};

// Full version for Documents tab - includes content_json and json_source_pdf_url
export const useAdminSubjectFull = (id?: string, enabled = false) => {
  return useQuery({
    queryKey: ["admin-subject-full", id],
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("popular_subjects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as PopularSubject;
    },
    enabled: !!id && enabled,
  });
};

export const useCreateSubject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (subject: Omit<PopularSubject, "id" | "created_at" | "updated_at"> & { category_id: string }) => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .insert(subject)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all subject-related queries
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects-base"] });
      toast({
        title: "Success",
        description: "Subject created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create subject",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateSubject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...subject }: Partial<PopularSubject> & { id: string }) => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .update(subject)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all subject-related queries
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects-base"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subject", data.id] });
      toast({
        title: "Success",
        description: "Subject updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subject",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteSubject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // O(1) - Single RPC call handles all deletions in transaction
      const { error } = await supabase.rpc('delete_subject_cascade', {
        p_subject_id: id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all subject-related queries
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects-base"] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects-paginated"] });
      toast({
        title: "Success",
        description: "Subject deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subject",
        variant: "destructive",
      });
    },
  });
};
