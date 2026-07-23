import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ExploreByGoal {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useAdminExploreByGoal = () => {
  return useQuery({
    queryKey: ["admin-explore-by-goal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("explore_by_goal")
        .select("*")
        .order("display_order");

      if (error) throw error;
      return data as ExploreByGoal[];
    },
  });
};

export const useAdminGoal = (id?: string) => {
  return useQuery({
    queryKey: ["admin-goal", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("explore_by_goal")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ExploreByGoal;
    },
    enabled: !!id,
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (goal: Omit<ExploreByGoal, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("explore_by_goal")
        .insert(goal)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-explore-by-goal"] });
      toast({
        title: "Success",
        description: "Goal created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goal",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...goal }: Partial<ExploreByGoal> & { id: string }) => {
      const { data, error } = await supabase
        .from("explore_by_goal")
        .update(goal)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-explore-by-goal"] });
      toast({
        title: "Success",
        description: "Goal updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update goal",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("explore_by_goal").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-explore-by-goal"] });
      toast({
        title: "Success",
        description: "Goal deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete goal",
        variant: "destructive",
      });
    },
  });
};
