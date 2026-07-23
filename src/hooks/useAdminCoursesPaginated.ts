import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PaginationParams {
  page: number;
  pageSize: number;
  categoryId?: string;
  subCategoryId?: string;
  searchTerm?: string;
}

interface CourseListItem {
  id: string;
  name: string;
  slug: string;
  price_inr: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface PaginatedResult {
  data: CourseListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Explicit fields - excludes all large columns (thumbnail_url, description, detailed_description, subjects)
const LIST_SELECT_FIELDS = `id, name, slug, price_inr, is_active, created_at`;

export const useAdminCoursesPaginated = (params: PaginationParams) => {
  const { page, pageSize, categoryId, subCategoryId, searchTerm } = params;

  return useQuery({
    queryKey: ["admin-courses-paginated", page, pageSize, categoryId, subCategoryId, searchTerm],
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async (): Promise<PaginatedResult> => {
      // Calculate range - O(1)
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Target category (most specific wins)
      const targetCategoryId = subCategoryId !== "all" ? subCategoryId : 
                               categoryId !== "all" ? categoryId : null;

      // Get category descendants in single RPC call
      let categoryIds: string[] | null = null;
      if (targetCategoryId) {
        const { data: descendants } = await supabase
          .rpc('get_category_descendants', { parent_uuid: targetCategoryId });
        categoryIds = descendants?.map((c: { category_id: string }) => c.category_id) || [targetCategoryId];
      }

      // Build query with server-side filters
      let query = supabase
        .from("courses")
        .select(
          categoryIds 
            ? `${LIST_SELECT_FIELDS}, course_categories!inner(category_id)` 
            : LIST_SELECT_FIELDS, 
          { count: 'exact' }
        );

      // Apply category filter via !inner JOIN
      if (categoryIds && categoryIds.length > 0) {
        query = query.in("course_categories.category_id", categoryIds);
      }

      // Apply search filter
      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      // Pagination with index-optimized ordering
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // O(n) deduplication where n=pageSize (typically 5)
      const seen = new Set<string>();
      const rawData = data as unknown as CourseListItem[];
      const uniqueCourses = (rawData || []).filter((course) => {
        if (seen.has(course.id)) return false;
        seen.add(course.id);
        return true;
      });

      return {
        data: uniqueCourses,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      };
    },
  });
};
