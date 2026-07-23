import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CourseFilters {
  categoryId?: string;
  subCategoryId?: string;
  searchTerm?: string;
}

export const useAdminCoursesFiltered = (filters: CourseFilters) => {
  return useQuery({
    queryKey: ["admin-courses-filtered", filters],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select(`
          *,
          course_categories(category_id)
        `)
        .order("created_at", { ascending: false });

      // Filter by specific sub-category
      if (filters.subCategoryId && filters.subCategoryId !== "all") {
        query = query.eq("course_categories.category_id", filters.subCategoryId);
      } 
      // Filter by parent category (includes parent and all children)
      else if (filters.categoryId && filters.categoryId !== "all") {
        // Get all child categories
        const { data: categories } = await supabase
          .from("categories")
          .select("id")
          .or(`id.eq.${filters.categoryId},parent_id.eq.${filters.categoryId}`);
        
        const categoryIds = categories?.map(c => c.id) || [filters.categoryId];
        query = query.in("course_categories.category_id", categoryIds);
      }

      // Filter by name (case-insensitive partial match)
      if (filters.searchTerm) {
        query = query.ilike("name", `%${filters.searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Remove duplicates (courses may appear multiple times due to multiple categories)
      const uniqueCourses = Array.from(
        new Map(data?.map(course => [course.id, course])).values()
      );

      return uniqueCourses;
    },
  });
};
