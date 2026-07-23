import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Optimized course fields - include thumbnail_url (skip base64 via getSafeThumbnailUrl helper)
const COURSE_SELECT_FIELDS = `
  id, name, slug, price_inr, original_price_inr,
  instructor_name, rating, student_count, duration_months, short_description,
  is_coming_soon,
  course_categories!inner(category_id),
  course_thumbnails(storage_url)
`;

// Helper to get safe thumbnail URL (skip base64 data)
export const getSafeThumbnailUrl = (url: string | null): string => {
  if (!url) return "/placeholder-course.jpg";
  // Only return if it's a proper URL, not base64
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return "/placeholder-course.jpg"; // Skip base64 images
};

export const useCoursesByHierarchy = (
  parentCategoryId?: string,
  subCategoryId?: string,
  subSubCategoryId?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ["courses-by-hierarchy", parentCategoryId, subCategoryId, subSubCategoryId],
    staleTime: 1000 * 60 * 10, // 10 minutes - courses don't change frequently
    enabled, // Allow skipping query when data is provided via props
    queryFn: async () => {
      // Determine which category to use for filtering
      const targetCategoryId = subSubCategoryId || subCategoryId || parentCategoryId;

      // If no category selected - return most popular courses
      if (!targetCategoryId) {
        const { data, error } = await supabase
          .from("courses")
          .select(COURSE_SELECT_FIELDS)
          .eq("is_active", true)
          .order("student_count", { ascending: false })
          .limit(50);

        if (error) throw error;
        return deduplicateCourses(data);
      }

      // Use RPC function to get all descendant category IDs in one query
      const { data: categoryIds, error: rpcError } = await supabase
        .rpc('get_category_descendants', { parent_uuid: targetCategoryId });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        // Fallback to single category if RPC fails
        const { data, error } = await supabase
          .from("courses")
          .select(COURSE_SELECT_FIELDS)
          .eq("course_categories.category_id", targetCategoryId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return deduplicateCourses(data);
      }

      const ids = categoryIds?.map((c: { category_id: string }) => c.category_id) || [targetCategoryId];

      // Single query with all category IDs
      const { data, error } = await supabase
        .from("courses")
        .select(COURSE_SELECT_FIELDS)
        .in("course_categories.category_id", ids)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return deduplicateCourses(data);
    },
  });
};

// Helper to remove duplicate courses (course might be in multiple categories)
function deduplicateCourses<T extends { id: string }>(courses: T[] | null): T[] {
  if (!courses) return [];
  const seen = new Set<string>();
  return courses.filter(course => {
    if (seen.has(course.id)) return false;
    seen.add(course.id);
    return true;
  });
}
