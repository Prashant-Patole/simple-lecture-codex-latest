import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SupportArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleFeedback {
  id: string;
  article_id: string;
  user_id: string;
  is_helpful: boolean;
  created_at: string;
}

// Fetch all active articles for users
export const useSupportArticles = () => {
  return useQuery({
    queryKey: ["support-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_articles")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as SupportArticle[];
    },
  });
};

// Fetch all articles for admin (including inactive)
export const useAdminSupportArticles = () => {
  return useQuery({
    queryKey: ["admin-support-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_articles")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as SupportArticle[];
    },
  });
};

// Fetch user's feedback for articles
export const useUserArticleFeedback = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["article-feedback", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("support_article_feedback")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      return data as ArticleFeedback[];
    },
    enabled: !!userId,
  });
};

// Submit or update article feedback
export const useSubmitArticleFeedback = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      articleId,
      userId,
      isHelpful,
      existingFeedback,
    }: {
      articleId: string;
      userId: string;
      isHelpful: boolean;
      existingFeedback?: ArticleFeedback;
    }) => {
      // If user already has feedback
      if (existingFeedback) {
        // If clicking the same button, remove feedback
        if (existingFeedback.is_helpful === isHelpful) {
          const { error: deleteError } = await supabase
            .from("support_article_feedback")
            .delete()
            .eq("id", existingFeedback.id);

          if (deleteError) throw deleteError;

          // Update article counts
          const countField = isHelpful ? "helpful_count" : "not_helpful_count";
          const { data: articleData } = await supabase
            .from("support_articles")
            .select(countField)
            .eq("id", articleId)
            .single();
          
          if (articleData) {
            await supabase
              .from("support_articles")
              .update({ [countField]: Math.max(0, (articleData as any)[countField] - 1) })
              .eq("id", articleId);
          }

          return { action: "removed" };
        }

        // Changing from helpful to not helpful or vice versa
        const { error: updateError } = await supabase
          .from("support_article_feedback")
          .update({ is_helpful: isHelpful })
          .eq("id", existingFeedback.id);

        if (updateError) throw updateError;

        // Update both counts
        const incrementField = isHelpful ? "helpful_count" : "not_helpful_count";
        const decrementField = isHelpful ? "not_helpful_count" : "helpful_count";

        const { data: article } = await supabase
          .from("support_articles")
          .select("helpful_count, not_helpful_count")
          .eq("id", articleId)
          .single();

        if (article) {
          await supabase
            .from("support_articles")
            .update({
              [incrementField]: (article as any)[incrementField] + 1,
              [decrementField]: Math.max(0, (article as any)[decrementField] - 1),
            })
            .eq("id", articleId);
        }

        return { action: "updated" };
      }

      // New feedback
      const { error: insertError } = await supabase
        .from("support_article_feedback")
        .insert({
          article_id: articleId,
          user_id: userId,
          is_helpful: isHelpful,
        });

      if (insertError) throw insertError;

      // Increment count
      const countField = isHelpful ? "helpful_count" : "not_helpful_count";
      const { data: article } = await supabase
        .from("support_articles")
        .select(countField)
        .eq("id", articleId)
        .single();

      if (article) {
        await supabase
          .from("support_articles")
          .update({ [countField]: (article as any)[countField] + 1 })
          .eq("id", articleId);
      }

      return { action: "added" };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["support-articles"] });
      queryClient.invalidateQueries({ queryKey: ["article-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-articles"] });

      if (result.action === "removed") {
        toast({ title: "Feedback removed" });
      } else {
        toast({ title: "Thanks for your feedback!" });
      }
    },
    onError: (error) => {
      toast({
        title: "Error submitting feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Admin: Create article
export const useCreateArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (article: Omit<SupportArticle, "id" | "created_at" | "updated_at" | "helpful_count" | "not_helpful_count">) => {
      const { data, error } = await supabase
        .from("support_articles")
        .insert(article)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-articles"] });
      queryClient.invalidateQueries({ queryKey: ["support-articles"] });
      toast({ title: "Article created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error creating article",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Admin: Update article
export const useUpdateArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportArticle> & { id: string }) => {
      const { data, error } = await supabase
        .from("support_articles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-articles"] });
      queryClient.invalidateQueries({ queryKey: ["support-articles"] });
      toast({ title: "Article updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error updating article",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Admin: Delete article
export const useDeleteArticle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("support_articles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-articles"] });
      queryClient.invalidateQueries({ queryKey: ["support-articles"] });
      toast({ title: "Article deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error deleting article",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
