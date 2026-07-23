import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EnrolledCourse } from "./useEnrolledCoursesWithCategories";

export const useCheckerAllCourses = (enabled: boolean) => {
  return useQuery({
    queryKey: ["checker-all-courses"],
    queryFn: async (): Promise<EnrolledCourse[]> => {
      // Fetch all active courses
      const { data: courses, error } = await supabase
        .from("courses")
        .select("id, name, slug, thumbnail_url, short_description, duration_months, price_inr")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      if (!courses?.length) return [];

      // Fetch category info for all courses
      const courseIds = courses.map((c) => c.id);
      const { data: courseCategories } = await supabase
        .from("course_categories")
        .select("course_id, category_id, categories(id, name, icon, parent_id, level)")
        .in("course_id", courseIds);

      // Build category map
      const categoryMap = new Map<string, { categoryId: string; categoryName: string; parentCategoryId: string | null; parentCategoryName: string | null; parentCategoryIcon: string | null }>();

      if (courseCategories) {
        // Get parent category IDs
        const parentIds = new Set<string>();
        for (const cc of courseCategories) {
          const cat = cc.categories as any;
          if (cat?.parent_id) parentIds.add(cat.parent_id);
        }

        // Fetch parent categories
        let parentMap = new Map<string, any>();
        if (parentIds.size > 0) {
          const { data: parents } = await supabase
            .from("categories")
            .select("id, name, icon")
            .in("id", Array.from(parentIds));
          if (parents) {
            for (const p of parents) parentMap.set(p.id, p);
          }
        }

        for (const cc of courseCategories) {
          if (categoryMap.has(cc.course_id)) continue;
          const cat = cc.categories as any;
          if (!cat) continue;
          const parent = cat.parent_id ? parentMap.get(cat.parent_id) : null;
          categoryMap.set(cc.course_id, {
            categoryId: cat.id,
            categoryName: cat.name,
            parentCategoryId: parent?.id || cat.id,
            parentCategoryName: parent?.name || cat.name,
            parentCategoryIcon: parent?.icon || cat.icon,
          });
        }
      }

      return courses.map((c) => {
        const catInfo = categoryMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          thumbnail_url: c.thumbnail_url,
          short_description: c.short_description,
          duration_months: c.duration_months,
          price_inr: c.price_inr,
          enrolled_at: new Date().toISOString(),
          progress: 0,
          categoryId: catInfo?.categoryId || null,
          categoryName: catInfo?.categoryName || null,
          parentCategoryId: catInfo?.parentCategoryId || null,
          parentCategoryName: catInfo?.parentCategoryName || null,
          parentCategoryIcon: catInfo?.parentCategoryIcon || null,
        };
      });
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};
