import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  parent_id?: string;
  level: number;
  display_order: number;
  is_popular: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parent_name?: string;
  goal_ids?: string[];
}

/**
 * Builds a Map for O(1) category lookups by ID
 */
export const buildCategoryMap = (categories: Category[]): Map<string, Category> => {
  return new Map(categories.map(c => [c.id, c]));
};

/**
 * Pre-computes hierarchy display names for all categories
 * Returns a Map<categoryId, displayName> for O(1) lookups
 * Format: "Child - Parent - Grandparent"
 */
export const buildHierarchyDisplayMap = (
  categories: Category[],
  categoryMap?: Map<string, Category>
): Map<string, string> => {
  const map = categoryMap || buildCategoryMap(categories);
  const cache = new Map<string, string>();

  const buildPath = (catId: string): string => {
    if (cache.has(catId)) return cache.get(catId)!;

    const cat = map.get(catId);
    if (!cat) return "";

    const parentPath = cat.parent_id ? buildPath(cat.parent_id) : "";
    const result = parentPath ? `${cat.name} - ${parentPath}` : cat.name;
    cache.set(catId, result);
    return result;
  };

  categories.forEach(c => buildPath(c.id));
  return cache;
};

/**
 * Legacy function for backward compatibility
 * Prefer using buildHierarchyDisplayMap for batch lookups
 */
export const getCategoryHierarchyDisplay = (
  categoryId: string,
  categories: Category[]
): string => {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return "";

  const buildPath = (cat: Category): string[] => {
    const path = [cat.name];
    if (cat.parent_id) {
      const parent = categories.find((c) => c.id === cat.parent_id);
      if (parent) {
        path.push(...buildPath(parent));
      }
    }
    return path;
  };

  const pathParts = buildPath(category);
  return pathParts.join(" - ");
};

/**
 * Hook to get memoized category Map and hierarchy display names
 */
export const useCategoryMaps = (categories: Category[] | undefined) => {
  const categoryMap = useMemo(
    () => (categories ? buildCategoryMap(categories) : new Map<string, Category>()),
    [categories]
  );

  const hierarchyDisplayMap = useMemo(
    () => (categories ? buildHierarchyDisplayMap(categories, categoryMap) : new Map<string, string>()),
    [categories, categoryMap]
  );

  return { categoryMap, hierarchyDisplayMap };
};

export const useAdminCategories = () => {
  return useQuery({
    queryKey: ["admin-categories"],
    staleTime: 1000 * 60 * 5, // 5 minutes - categories rarely change
    gcTime: 1000 * 60 * 30, // 30 minutes in cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Build lookup map once - O(n)
      const categoryMap = new Map(data.map(c => [c.id, c]));

      // Use map for O(1) lookups instead of O(n) find
      const categoriesWithParents = data.map((cat) => ({
        ...cat,
        parent_name: cat.parent_id ? categoryMap.get(cat.parent_id)?.name : undefined,
      }));

      return categoriesWithParents as Category[];
    },
  });
};

export const useAdminCategory = (id?: string) => {
  return useQuery({
    queryKey: ["admin-category", id],
    queryFn: async () => {
      if (!id) return null;

      // Single query with join instead of 2 separate queries
      const { data, error } = await supabase
        .from("categories")
        .select(`
          *,
          category_goals(goal_id)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      return {
        ...data,
        goal_ids: data.category_goals?.map((g: { goal_id: string }) => g.goal_id) || [],
      } as Category;
    },
    enabled: !!id,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (category: Omit<Category, "id" | "created_at" | "updated_at">) => {
      const { goal_ids, ...categoryData } = category;

      const { data, error } = await supabase
        .from("categories")
        .insert(categoryData)
        .select()
        .single();

      if (error) throw error;

      // Associate goals
      if (goal_ids && goal_ids.length > 0) {
        const goalAssociations = goal_ids.map((goal_id) => ({
          category_id: data.id,
          goal_id,
        }));

        await supabase.from("category_goals").insert(goalAssociations);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...category }: Partial<Category> & { id: string }) => {
      const { goal_ids, ...categoryData } = category;

      const { data, error } = await supabase
        .from("categories")
        .update(categoryData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Update goals
      if (goal_ids !== undefined) {
        await supabase.from("category_goals").delete().eq("category_id", id);

        if (goal_ids.length > 0) {
          const goalAssociations = goal_ids.map((goal_id) => ({
            category_id: id,
            goal_id,
          }));

          await supabase.from("category_goals").insert(goalAssociations);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });
};
