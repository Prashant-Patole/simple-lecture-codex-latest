import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UsePaginatedCoursesOptions {
  page: number;
  pageSize: number;
  searchQuery?: string;
  categoryId?: string;
  subcategoryId?: string;
  subSubcategoryId?: string;
  sortBy?: "newest" | "popular" | "price-low" | "price-high";
  enabled?: boolean;
}

interface PaginatedResult {
  courses: any[];
  totalCount: number;
  totalPages: number;
}

// Optimized fields for card display - excludes large text columns
const CARD_SELECT_FIELDS = `
  id, name, slug, price_inr, original_price_inr, short_description,
  duration_months, student_count, rating, instructor_name, thumbnail_url,
  course_thumbnails(storage_url)
`;

// Helper to get sort configuration
const getSortConfig = (sortBy: string): { column: string; ascending: boolean } => {
  switch (sortBy) {
    case "popular":
      return { column: "student_count", ascending: false };
    case "price-low":
      return { column: "price_inr", ascending: true };
    case "price-high":
      return { column: "price_inr", ascending: false };
    case "newest":
    default:
      return { column: "created_at", ascending: false };
  }
};

export const usePaginatedCourses = ({
  page,
  pageSize,
  searchQuery,
  categoryId,
  subcategoryId,
  subSubcategoryId,
  sortBy = "newest",
  enabled = true,
}: UsePaginatedCoursesOptions) => {
  return useQuery({
    queryKey: ["paginated-courses", page, pageSize, searchQuery, categoryId, subcategoryId, subSubcategoryId, sortBy],
    enabled: enabled !== false,
    queryFn: async (): Promise<PaginatedResult> => {
      const offset = (page - 1) * pageSize;
      const { column: sortColumn, ascending: sortAscending } = getSortConfig(sortBy);

      // Determine target category for filtering (most specific wins)
      const targetCategoryId = subSubcategoryId || subcategoryId || categoryId;

      // PHASE 1: Get all category IDs in one RPC call (replaces 2 sequential queries)
      let categoryIds: string[] | null = null;
      
      if (targetCategoryId) {
        const { data: descendants, error: rpcError } = await supabase
          .rpc('get_category_descendants', { parent_uuid: targetCategoryId });

        if (rpcError) {
          console.error("RPC error fetching category descendants:", rpcError);
          // Fallback to single category if RPC fails
          categoryIds = [targetCategoryId];
        } else {
          categoryIds = descendants?.map((c: { category_id: string }) => c.category_id) || [targetCategoryId];
        }
      }

      // PHASE 2 & 3: Single optimized query with JOIN + count
      if (categoryIds && categoryIds.length > 0) {
        // Use !inner JOIN to filter by category - combines data + count in one request
        const { data, count, error } = await supabase
          .from("courses")
          .select(`
            ${CARD_SELECT_FIELDS},
            course_categories!inner(category_id)
          `, { count: "exact" })
          .in("course_categories.category_id", categoryIds)
          .eq("is_active", true)
          .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        // Deduplicate courses (may appear in multiple categories)
        const seen = new Set<string>();
        const uniqueCourses = (data || []).filter(course => {
          if (seen.has(course.id)) return false;
          seen.add(course.id);
          return true;
        });

        // Filter out base64 thumbnails - use storage_url instead
        const cleanedCourses = uniqueCourses.map(course => ({
          ...course,
          thumbnail_url: course.thumbnail_url?.startsWith('data:') 
            ? (course.course_thumbnails?.storage_url || null)
            : course.thumbnail_url
        }));

        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / pageSize);

        return {
          courses: cleanedCourses,
          totalCount,
          totalPages,
        };
      }

      // No category filter - query all active courses
      let query = supabase
        .from("courses")
        .select(CARD_SELECT_FIELDS, { count: "exact" })
        .eq("is_active", true);

      // Apply search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const search = `%${searchQuery.trim()}%`;
        query = query.or(`name.ilike.${search},short_description.ilike.${search},description.ilike.${search}`);
      }

      // Apply sorting and pagination
      query = query
        .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
        .range(offset, offset + pageSize - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      // Filter out base64 thumbnails for non-category queries too
      const cleanedCourses = (data || []).map(course => ({
        ...course,
        thumbnail_url: course.thumbnail_url?.startsWith('data:') 
          ? (course.course_thumbnails?.storage_url || null)
          : course.thumbnail_url
      }));

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        courses: cleanedCourses,
        totalCount,
        totalPages,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
};

// Hook for global search across all courses (for header search)
export const useSearchCourses = (searchQuery: string, limit: number = 10) => {
  return useQuery({
    queryKey: ["search-courses", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        return [];
      }

      const search = `%${searchQuery.trim()}%`;
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, slug, thumbnail_url, price_inr, short_description")
        .eq("is_active", true)
        .or(`name.ilike.${search},short_description.ilike.${search}`)
        .order("student_count", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.trim().length >= 2,
    staleTime: 60000, // Cache search results for 1 minute
  });
};
