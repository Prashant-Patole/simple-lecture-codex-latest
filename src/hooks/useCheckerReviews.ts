import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface CheckerReview {
  id: string;
  reviewer_id: string;
  entity_type: string;
  entity_id: string;
  comment: string;
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useCheckerReviews = (entityType: "lecture" | "question", entityIds: string[]) => {
  return useQuery({
    queryKey: ["checker-reviews", entityType, entityIds],
    queryFn: async () => {
      if (!entityIds.length) return [];
      const { data, error } = await supabase
        .from("checker_reviews" as any)
        .select("*")
        .eq("entity_type", entityType)
        .in("entity_id", entityIds);
      if (error) throw error;
      return (data || []) as unknown as CheckerReview[];
    },
    enabled: entityIds.length > 0,
    staleTime: 30000,
  });
};

export const useSaveCheckerReview = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      comment,
    }: {
      entityType: "lecture" | "question";
      entityId: string;
      comment: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("checker_reviews" as any)
        .upsert(
          {
            reviewer_id: user.id,
            entity_type: entityType,
            entity_id: entityId,
            comment,
          },
          { onConflict: "entity_type,entity_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["checker-reviews", variables.entityType] });
      toast({ title: "Comment saved" });
    },
    onError: () => {
      toast({ title: "Failed to save comment", variant: "destructive" });
    },
  });
};

export const useApproveEntity = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      approve,
    }: {
      entityType: "lecture" | "question";
      entityId: string;
      approve: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("checker_reviews" as any)
        .upsert(
          {
            reviewer_id: user.id,
            entity_type: entityType,
            entity_id: entityId,
            is_approved: approve,
            approved_at: approve ? new Date().toISOString() : null,
          },
          { onConflict: "entity_type,entity_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["checker-reviews", variables.entityType] });
      toast({ title: variables.approve ? "Approved!" : "Approval removed" });
    },
    onError: () => {
      toast({ title: "Failed to update approval", variant: "destructive" });
    },
  });
};
