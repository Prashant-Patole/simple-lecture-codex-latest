import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CategoryHierarchy {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description?: string | null;
  display_order: number | null;
  subcategories: CategoryHierarchy[];
}

interface Course {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price_inr: number | null;
  original_price_inr: number | null;
  duration_months: number | null;
  student_count: number | null;
  rating: number | null;
  instructor_name: string | null;
  is_active: boolean | null;
  is_coming_soon: boolean | null;
  course_thumbnails: { storage_url: string } | { storage_url: string }[] | null;
}

interface FeaturedCourse {
  id: string;
  course_id: string;
  display_order: number | null;
  courses: Course | null;
}

interface ExploreGoal {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number | null;
  is_active: boolean | null;
  link_type: string | null;
  link_url: string | null;
  open_in_new_tab: boolean | null;
}

export interface HeroVideoSettings {
  enabled: boolean;
  youtube_url: string;
}

export interface HomepageData {
  categories: CategoryHierarchy[];
  courses: Course[];
  bestsellers: FeaturedCourse[];
  topCourses: FeaturedCourse[];
  mostPopular: FeaturedCourse[];
  exploreGoals: ExploreGoal[];
  heroVideoSettings: HeroVideoSettings;
}

const TIMEOUT_MS = 10000; // 10 second timeout

const fetchWithTimeout = async (): Promise<HomepageData> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke("homepage-data", {
      method: "GET",
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error("Homepage data fetch error:", error);
      throw error;
    }

    console.log("Homepage data received:", {
      categories: data?.categories?.length || 0,
      courses: data?.courses?.length || 0,
      bestsellers: data?.bestsellers?.length || 0,
      topCourses: data?.topCourses?.length || 0,
      mostPopular: data?.mostPopular?.length || 0,
      exploreGoals: data?.exploreGoals?.length || 0,
    });

    return data as HomepageData;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  }
};

export const useHomepageData = () => {
  return useQuery<HomepageData>({
    queryKey: ["homepage-data"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
    queryFn: fetchWithTimeout,
  });
};
