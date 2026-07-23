import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDocumentation = (category?: string, subcategory?: string) => {
  return useQuery({
    queryKey: ["documentation", category, subcategory],
    queryFn: async () => {
      let query = supabase
        .from("documentation_pages")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (category) {
        query = query.eq("category", category);
      }

      if (subcategory) {
        query = query.eq("subcategory", subcategory);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
};

export const useDocumentationPage = (pageKey: string) => {
  return useQuery({
    queryKey: ["documentation-page", pageKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentation_pages")
        .select("*")
        .eq("page_key", pageKey)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!pageKey,
  });
};

export const useCreateDocumentationPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { data: page, error } = await supabase
        .from("documentation_pages")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return page;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      toast.success("Documentation page created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create documentation page");
    },
  });
};

export const useUpdateDocumentationPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: page, error } = await supabase
        .from("documentation_pages")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return page;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      toast.success("Documentation page updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update documentation page");
    },
  });
};