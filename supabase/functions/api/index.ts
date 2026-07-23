import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Route handling
    if (path.startsWith("/api/v1/courses")) {
      return await handleCourses(req, supabaseClient, path);
    } else if (path.startsWith("/api/v1/subjects")) {
      return await handleSubjects(req, supabaseClient);
    } else if (path.startsWith("/api/v1/instructors")) {
      return await handleInstructors(req, supabaseClient);
    } else if (path.startsWith("/api/v1/categories")) {
      return await handleCategories(req, supabaseClient);
    } else if (path.startsWith("/api/v1/student/enrollments")) {
      return await handleEnrollments(req, supabaseClient);
    } else {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCourses(req: Request, supabase: any, path: string) {
  const url = new URL(req.url);
  const courseId = path.split("/").pop();

  if (courseId && courseId !== "courses") {
    // Get single course with all relations
    const { data: course, error } = await supabase
      .from("courses")
      .select(`
        *,
        categories:course_categories(category:categories(*)),
        subjects:course_subjects(subject:popular_subjects(*)),
        instructors:course_instructors(instructor:teacher_profiles(*)),
        faqs:course_faqs(*)
      `)
      .eq("id", courseId)
      .eq("is_active", true)
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(course), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } else {
    // List courses with pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const category = url.searchParams.get("category");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("courses")
      .select(`
        *,
        categories:course_categories(category:categories(*))
      `, { count: "exact" })
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("course_categories.category.slug", category);
    }

    const { data: courses, error, count } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({
        data: courses,
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count! / limit),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleSubjects(req: Request, supabase: any) {
  const { data: subjects, error } = await supabase
    .from("popular_subjects")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw error;

  return new Response(JSON.stringify(subjects), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleInstructors(req: Request, supabase: any) {
  const { data: instructors, error } = await supabase
    .from("teacher_profiles")
    .select(`
      *,
      subjects:instructor_subjects(subject:popular_subjects(*))
    `)
    .eq("is_active", true);

  if (error) throw error;

  return new Response(JSON.stringify(instructors), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCategories(req: Request, supabase: any) {
  const { data: categories, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw error;

  return new Response(JSON.stringify(categories), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleEnrollments(req: Request, supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select(`
      *,
      course:courses(*),
      batch:batches(*)
    `)
    .eq("student_id", user.id)
    .eq("is_active", true);

  if (error) throw error;

  return new Response(JSON.stringify(enrollments), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}