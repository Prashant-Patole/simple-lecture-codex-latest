import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://simplelecture.com";

const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/programs", changefreq: "weekly", priority: "0.9" },
  { path: "/forum", changefreq: "daily", priority: "0.7" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/support", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.4" },
];

// Programmatic SEO landing pages (/learn/:slug)
const LANDING_SLUGS = [
  "jee-main-online-coaching",
  "neet-2026-online-coaching",
  "class-12-physics-online-classes",
  "class-11-physics-online-classes",
  "physics-online-classes",
  "online-coaching-india",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: courses } = await supabase
      .from("courses")
      .select("slug, created_at")
      .eq("is_active", true)
      .order("sequence_order", { ascending: true });

    const { data: subjects } = await supabase
      .from("popular_subjects")
      .select("slug, updated_at");

    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, created_at")
      .eq("status", "published");

    const { data: goals } = await supabase
      .from("explore_by_goal")
      .select("slug, updated_at")
      .eq("is_active", true);

    const today = new Date().toISOString().split("T")[0];
    const day = (d) => (d ? String(d).split("T")[0] : today);

    const url = (loc, lastmod, changefreq, priority) =>
      `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

    const staticUrls = STATIC_PAGES.map((p) =>
      url(`${BASE_URL}${p.path}`, today, p.changefreq, p.priority)
    ).join("\n");

    const landingUrls = LANDING_SLUGS.map((slug) =>
      url(`${BASE_URL}/learn/${slug}`, today, "weekly", "0.85")
    ).join("\n");

    const courseUrls = (courses || [])
      .map((c) => url(`${BASE_URL}/course/${c.slug}`, day(c.created_at), "weekly", "0.8"))
      .join("\n");

    const subjectUrls = (subjects || [])
      .filter((s) => s.slug)
      .map((s) => url(`${BASE_URL}/subject/${s.slug}`, day(s.updated_at), "weekly", "0.75"))
      .join("\n");

    const blogUrls = (posts || [])
      .map((p) => url(`${BASE_URL}/blog/${p.slug}`, day(p.created_at), "monthly", "0.6"))
      .join("\n");

    const goalUrls = (goals || [])
      .filter((g) => g.slug)
      .map((g) => url(`${BASE_URL}/explore/${g.slug}`, day(g.updated_at), "weekly", "0.7"))
      .join("\n");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${landingUrls}
${courseUrls}
${subjectUrls}
${goalUrls}
${blogUrls}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
