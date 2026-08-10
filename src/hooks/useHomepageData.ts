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

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const normalizeHomepageData = (data: any): HomepageData => {
  if (!data || typeof data !== "object" || data.error) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Homepage data is unavailable. Please try again.",
    );
  }

  return {
    categories: asArray(data.categories),
    courses: asArray(data.courses),
    bestsellers: asArray(data.bestsellers),
    topCourses: asArray(data.topCourses),
    mostPopular: asArray(data.mostPopular),
    exploreGoals: asArray(data.exploreGoals),
    heroVideoSettings: {
      enabled: Boolean(data.heroVideoSettings?.enabled),
      youtube_url: String(data.heroVideoSettings?.youtube_url || ""),
    },
  };
};

const fetchWithTimeout = async (): Promise<HomepageData> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Prefer POST — some edge gateways return 404 for function GET invokes.
    const { data, error } = await supabase.functions.invoke("homepage-data", {
      method: "POST",
      body: {},
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error("Homepage data fetch error:", error);
      throw error;
    }

    const normalized = normalizeHomepageData(data);
    console.log("Homepage data received:", {
      categories: normalized.categories.length,
      courses: normalized.courses.length,
      bestsellers: normalized.bestsellers.length,
      topCourses: normalized.topCourses.length,
      mostPopular: normalized.mostPopular.length,
      exploreGoals: normalized.exploreGoals.length,
    });

    return normalized;
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
