import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategoryWithSubjects {
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
  parent_name?: string;
  display_name: string; // "Subcategory - Parent" or just "Category"
}

export const useCategoriesWithSubjects = () => {
  return useQuery({
    queryKey: ["categories-with-subjects"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      // Get all categories that have subjects
      const { data: categoriesWithSubjects, error: catError } = await supabase
        .from("categories")
        .select(`
          *,
          popular_subjects!inner(id)
        `)
        .eq("is_active", true)
        .order("level")
        .order("display_order");

      if (catError) throw catError;

      // O(n) deduplication using Set - replaces O(n²) .find() in .reduce()
      const seen = new Set<string>();
      const uniqueCategories = categoriesWithSubjects.filter(cat => {
        if (seen.has(cat.id)) return false;
        seen.add(cat.id);
        return true;
      });

      // O(n) - Build Map for O(1) parent lookups
      const categoryMap = new Map(uniqueCategories.map(c => [c.id, c]));

      // O(n) - Build display names with O(1) parent lookups
      const categoriesWithDisplay = uniqueCategories.map((cat) => {
        // O(1) lookup instead of O(n) .find()
        const parent = cat.parent_id ? categoryMap.get(cat.parent_id) : undefined;
        const display_name = parent 
          ? `${cat.name} - ${parent.name}` 
          : cat.name;

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          description: cat.description,
          parent_id: cat.parent_id,
          level: cat.level,
          display_order: cat.display_order,
          is_popular: cat.is_popular,
          is_active: cat.is_active,
          parent_name: parent?.name,
          display_name,
        } as CategoryWithSubjects;
      });

      return categoriesWithDisplay;
    },
  });
};
