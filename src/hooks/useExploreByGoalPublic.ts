import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useExploreByGoalPublic = () => {
  return useQuery({
    queryKey: ["explore-by-goal-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("explore_by_goal")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data;
    },
  });
};

export const useCoursesByGoal = (goalSlug?: string, filterCategoryId?: string) => {
  return useQuery({
    queryKey: ["courses-by-goal", goalSlug, filterCategoryId],
    queryFn: async () => {
      if (!goalSlug) return null;

      // Step 1: Get the goal
      const { data: goal, error: goalError } = await supabase
        .from("explore_by_goal")
        .select("id, name, description")
        .eq("slug", goalSlug)
        .eq("is_active", true)
        .single();

      if (goalError) throw goalError;

      // Step 2: Get categories linked to this goal from category_goals
      const { data: linkedCategories, error: catError } = await supabase
        .from("category_goals")
        .select("category_id")
        .eq("goal_id", goal.id);

      if (catError) throw catError;

      if (!linkedCategories || linkedCategories.length === 0) {
        return { goal, courses: [] };
      }

      // Step 3: Get all descendant categories for each linked category
      const allCategoryIds: string[] = [];
      
      for (const { category_id } of linkedCategories) {
        if (category_id) {
          const { data: descendants } = await supabase
            .rpc('get_category_descendants', { parent_uuid: category_id });
          
          if (descendants) {
            descendants.forEach((d: { category_id: string }) => {
              if (!allCategoryIds.includes(d.category_id)) {
                allCategoryIds.push(d.category_id);
              }
            });
          }
        }
      }

      if (allCategoryIds.length === 0) {
        return { goal, courses: [] };
      }

      // Step 4: Fetch courses from these categories
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select(`
          id, name, slug, thumbnail_url, short_description,
          price_inr, original_price_inr, duration_months,
          student_count, rating, is_active, is_coming_soon,
          course_categories!inner(category_id),
          course_subjects(id),
          course_thumbnails(storage_url)
        `)
        .in("course_categories.category_id", allCategoryIds)
        .eq("is_active", true);

      if (coursesError) throw coursesError;

      // Deduplicate courses (may appear in multiple categories)
      const seen = new Set<string>();
      let courses = (coursesData || []).filter(course => {
        if (seen.has(course.id)) return false;
        seen.add(course.id);
        return true;
      });

      // Apply filter category if provided
      if (filterCategoryId && filterCategoryId !== "all") {
        courses = courses.filter((course: any) =>
          course.course_categories?.some(
            (cc: any) => cc.category_id === filterCategoryId
          )
        );
      }

      // Fix thumbnail URLs (filter base64)
      courses = courses.map(course => ({
        ...course,
        thumbnail_url: course.thumbnail_url?.startsWith('data:')
          ? ((course.course_thumbnails as any)?.storage_url || null)
          : course.thumbnail_url
      }));

      return { goal, courses };
    },
    enabled: !!goalSlug,
  });
};
