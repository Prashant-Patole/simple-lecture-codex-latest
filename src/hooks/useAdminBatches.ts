import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Batch {
  id: string;
  name: string;
  course_id: string;
  start_date: string;
  end_date?: string;
  max_students?: number;
  current_students: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  course?: {
    id: string;
    name: string;
  };
}

export const useAdminBatches = (courseId?: string) => {
  return useQuery({
    queryKey: ["admin-batches", courseId],
    queryFn: async () => {
      let query = supabase
        .from("batches")
        .select(`
          *,
          course:courses(id, name)
        `)
        .order("created_at", { ascending: false });

      if (courseId) {
        query = query.eq("course_id", courseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useAdminBatch = (id?: string) => {
  return useQuery({
    queryKey: ["admin-batch", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("batches")
        .select(`
          *,
          course:courses(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
};

export const useCreateBatch = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batchData: {
      name: string;
      course_id: string;
      start_date: string;
      end_date?: string;
      max_students?: number;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from("batches")
        .insert(batchData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
      toast({
        title: "Success",
        description: "Batch created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateBatch = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...batchData }: Partial<Batch> & { id: string }) => {
      const { data, error } = await supabase
        .from("batches")
        .update(batchData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
      queryClient.invalidateQueries({ queryKey: ["admin-batch"] });
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteBatch = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("batches")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
