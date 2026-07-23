import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

// Helper to sanitize icon fields - removes base64 blobs, keeps emojis/URLs
function sanitizeIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  // If it's a base64 data URL, return fallback emoji
  if (icon.startsWith('data:image')) return null;
  return icon;
}

// Recursively sanitize icons in category hierarchy
function sanitizeCategories(categories: any[]): any[] {
  return categories.map(cat => ({
    ...cat,
    icon: sanitizeIcon(cat.icon),
    subcategories: cat.subcategories ? sanitizeCategories(cat.subcategories) : []
  }));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Support both GET and POST for cacheability
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Fast-path for health check / warm-up (no cold start penalty on next request)
  const url = new URL(req.url);
  if (url.searchParams.get("ping") === "true") {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Service role client bypasses RLS - used only for public config reads
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Fetching homepage data...");

    // Execute all queries in parallel - this is much faster than browser making 5 separate requests
    const [
      categoriesResult,
      coursesResult,
      bestsellersResult,
      topCoursesResult,
      mostPopularResult,
      exploreGoalsResult,
      heroVideoResult
    ] = await Promise.all([
      // Categories with hierarchy (level 1 only, with subcategories)
      supabase
        .from("categories")
        .select(`
          id,
          name,
          slug,
          icon,
          display_order,
          subcategories:categories!parent_id(
            id,
            name,
            slug,
            icon,
            display_order,
            subcategories:categories!parent_id(
              id,
              name,
              slug,
              icon,
              display_order
            )
          )
        `)
        .eq("level", 1)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),

      // Courses with thumbnails - minimal fields for homepage cards
      supabase
        .from("courses")
        .select(`
          id,
          name,
          slug,
          short_description,
          price_inr,
          original_price_inr,
          duration_months,
          student_count,
          rating,
          instructor_name,
          is_active,
          is_coming_soon,
          course_thumbnails(storage_url)
        `)
        .eq("is_active", true)
        .order("student_count", { ascending: false })
        .limit(50),

      // Bestsellers featured courses
      supabase
        .from("featured_courses")
        .select(`
          id,
          course_id,
          display_order,
          courses(
            id,
            name,
            slug,
            short_description,
            price_inr,
            original_price_inr,
            duration_months,
            student_count,
            rating,
            instructor_name,
            is_coming_soon,
            course_thumbnails(storage_url)
          )
        `)
        .eq("section_type", "bestsellers")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),

      // Top courses featured courses
      supabase
        .from("featured_courses")
        .select(`
          id,
          course_id,
          display_order,
          courses(
            id,
            name,
            slug,
            short_description,
            price_inr,
            original_price_inr,
            duration_months,
            student_count,
            rating,
            instructor_name,
            is_coming_soon,
            course_thumbnails(storage_url)
          )
        `)
        .eq("section_type", "top_courses")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),

      // Most popular featured courses
      supabase
        .from("featured_courses")
        .select(`
          id,
          course_id,
          display_order,
          courses(
            id,
            name,
            slug,
            short_description,
            price_inr,
            original_price_inr,
            duration_months,
            student_count,
            rating,
            instructor_name,
            is_coming_soon,
            course_thumbnails(storage_url)
          )
        `)
        .eq("section_type", "most_popular")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),

      // Explore by goal - explicit fields only, NO icon column (may contain base64)
      supabase
        .from("explore_by_goal")
        .select("id, name, slug, description, display_order, is_active, link_type, link_url, open_in_new_tab")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),

      // Hero video settings - use admin client to bypass RLS
      supabaseAdmin
        .from("ai_settings")
        .select("setting_value")
        .eq("setting_key", "hero_video")
        .maybeSingle()
    ]);

    // Check for errors
    if (categoriesResult.error) {
      console.error("Categories error:", categoriesResult.error);
    }
    if (coursesResult.error) {
      console.error("Courses error:", coursesResult.error);
    }
    if (bestsellersResult.error) {
      console.error("Bestsellers error:", bestsellersResult.error);
    }
    if (topCoursesResult.error) {
      console.error("Top courses error:", topCoursesResult.error);
    }
    if (mostPopularResult.error) {
      console.error("Most popular error:", mostPopularResult.error);
    }
    if (exploreGoalsResult.error) {
      console.error("Explore goals error:", exploreGoalsResult.error);
    }
    if (heroVideoResult.error) {
      console.error("Hero video error:", heroVideoResult.error);
    }

    // Sanitize categories to remove any base64 icons
    const sanitizedCategories = sanitizeCategories(categoriesResult.data || []);

    // Parse hero video settings with defaults
    const heroVideoSettings = heroVideoResult.data?.setting_value || { enabled: false, youtube_url: "" };

    const responseData = {
      categories: sanitizedCategories,
      courses: coursesResult.data || [],
      bestsellers: bestsellersResult.data || [],
      topCourses: topCoursesResult.data || [],
      mostPopular: mostPopularResult.data || [],
      exploreGoals: exploreGoalsResult.data || [],
      heroVideoSettings,
    };

    console.log(`Homepage data fetched: ${responseData.categories.length} categories, ${responseData.courses.length} courses, ${responseData.bestsellers.length} bestsellers, ${responseData.topCourses.length} top courses, ${responseData.exploreGoals.length} goals`);

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (error) {
    console.error("Homepage data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch homepage data" }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});
