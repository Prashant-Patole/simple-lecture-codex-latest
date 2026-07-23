// Runtime per-route head rewriter.
//
// Returns a full index.html shell with <title>, meta description, OG/Twitter
// tags, canonical, and JSON-LD populated from the database for the given path.
// Designed to sit behind the Cloudflare proxy worker so social-share scrapers
// (Facebook, WhatsApp, LinkedIn, Twitter, ChatGPT) and view-source see
// per-course / per-subject / per-blog metadata without waiting for a rebuild.
//
// Invocation:
//   GET /functions/v1/seo-head?path=/course/some-slug
//   GET /functions/v1/seo-head?path=/subject/some-slug
//   GET /functions/v1/seo-head?path=/blog/some-slug
//
// Always returns 200 with HTML — never 404 (the SPA handles unknown slugs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SITE_URL = "https://simplelecture.com";
const SITE_NAME = "SimpleLecture";
const DEFAULT_OG = `${SITE_URL}/og-default.png`;
const SHELL_SOURCE = `${SITE_URL}/index.html`;
const SHELL_TTL_MS = 5 * 60 * 1000;

let shellCache: { html: string; at: number } | null = null;

async function getShell(): Promise<string> {
  if (shellCache && Date.now() - shellCache.at < SHELL_TTL_MS) {
    return shellCache.html;
  }
  try {
    const res = await fetch(SHELL_SOURCE, {
      headers: { "User-Agent": "SimpleLecture-SEO-Head/1.0" },
    });
    if (res.ok) {
      const html = await res.text();
      shellCache = { html, at: Date.now() };
      return html;
    }
  } catch (e) {
    console.error("Shell fetch failed:", e);
  }
  // Last-resort fallback: a minimal shell. Real shell will be picked up on
  // next successful fetch.
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>SimpleLecture</title><meta name="description" content="SimpleLecture" /><link rel="canonical" href="${SITE_URL}/" /></head><body><div id="root"></div></body></html>`;
}

// ─── String helpers ──────────────────────────────────────────────────────

const escAttr = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escHtml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function truncate(str: string | null | undefined, n = 158): string {
  if (!str) return "";
  const clean = String(str).replace(/[#*_`>\n\r]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

function replaceMeta(html: string, attr: string, key: string, value: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escAttr(value)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

interface RouteMeta {
  title: string;
  description: string;
  keywords?: string;
  canonical: string;
  ogImage: string;
  ogType: "website" | "article";
  ogTitle?: string;
  ogDescription?: string;
  h1: string;
  lead: string;
  jsonLd: object[];
}

function rewriteShell(shell: string, meta: RouteMeta): string {
  const title = /\|\s*SimpleLecture\s*$/.test(meta.title) ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const ogTitleRaw = meta.ogTitle || meta.title;
  const ogTitle = /\|\s*SimpleLecture\s*$/.test(ogTitleRaw) ? ogTitleRaw : `${ogTitleRaw} | ${SITE_NAME}`;
  const ogDesc = meta.ogDescription || meta.description;
  let html = shell;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)}</title>`);
  html = replaceMeta(html, "name", "description", meta.description);
  if (meta.keywords) html = replaceMeta(html, "name", "keywords", meta.keywords);

  // Canonical: replace the first canonical, remove any extras.
  const canonicalTag = `<link rel="canonical" href="${escAttr(meta.canonical)}" />`;
  if (/<link\s+rel="canonical"[^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel="canonical"[^>]*>/i, canonicalTag);
    html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, (m, offset) =>
      offset === html.indexOf(canonicalTag) ? m : ""
    );
  } else {
    html = html.replace(/<\/head>/i, `    ${canonicalTag}\n  </head>`);
  }

  html = replaceMeta(html, "property", "og:title", ogTitle);
  html = replaceMeta(html, "property", "og:description", ogDesc);
  html = replaceMeta(html, "property", "og:type", meta.ogType);
  html = replaceMeta(html, "property", "og:url", meta.canonical);
  html = replaceMeta(html, "property", "og:image", meta.ogImage);

  html = replaceMeta(html, "name", "twitter:title", ogTitle);
  html = replaceMeta(html, "name", "twitter:description", ogDesc);
  html = replaceMeta(html, "name", "twitter:image", meta.ogImage);

  // Strip any pre-existing JSON-LD, then inject ours before </head>.
  html = html.replace(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ""
  );
  if (meta.jsonLd.length) {
    const scripts = meta.jsonLd
      .map(
        (obj) =>
          `<script type="application/ld+json">${JSON.stringify(obj).replace(
            /<\/script/gi,
            "<\\/script"
          )}</script>`
      )
      .join("\n    ");
    html = html.replace(/<\/head>/i, `    ${scripts}\n  </head>`);
  }

  // No-JS body fallback inside #root.
  const fallback = `
      <noscript>
        <article style="max-width:760px;margin:2rem auto;padding:1rem;font-family:system-ui,sans-serif;">
          <h1>${escHtml(meta.h1)}</h1>
          <p>${escHtml(meta.lead)}</p>
          <p><a href="${escAttr(meta.canonical)}">Open SimpleLecture →</a></p>
        </article>
      </noscript>
      <div data-seo-fallback="1" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">
        <h1>${escHtml(meta.h1)}</h1>
        <p>${escHtml(meta.lead)}</p>
      </div>`;

  if (!html.includes('data-seo-fallback="1"')) {
    // Inject just after <div id="root">…opening tag. Match either the empty
    // <div id="root"></div> or one already containing a loader.
    if (/<div\s+id="root"\s*>/i.test(html)) {
      html = html.replace(/<div\s+id="root"\s*>/i, (m) => `${m}${fallback}`);
    }
  }

  return html;
}

// ─── Per-entity builders ─────────────────────────────────────────────────

function buildCourseMeta(course: any, path: string): RouteMeta {
  const canonical =
    (course.seo_canonical_url && String(course.seo_canonical_url).trim()) ||
    `${SITE_URL}${path}`;
  const baseDesc =
    course.seo_description ||
    course.short_description ||
    `${course.name} — online coaching with live classes, recorded video lectures, AI doubt solver and mock tests on SimpleLecture.`;
  const desc = truncate(baseDesc);
  const ogImage =
    (course.og_image_url && !String(course.og_image_url).startsWith("data:") && course.og_image_url) ||
    (course.thumbnail_url && !String(course.thumbnail_url).startsWith("data:") && course.thumbnail_url) ||
    DEFAULT_OG;
  const title =
    (course.seo_title && String(course.seo_title).trim()) ||
    `${course.name} — Online Coaching & Live Classes`;
  const keywords =
    (course.seo_keywords && String(course.seo_keywords).trim()) ||
    `${course.name}, ${course.name} online coaching, ${course.name} video lectures, ${course.name} mock test, ${SITE_NAME}`;
  return {
    title,
    description: desc,
    keywords,
    canonical,
    ogImage,
    ogType: "website",
    ogTitle: (course.og_title && String(course.og_title).trim()) || undefined,
    ogDescription: (course.og_description && String(course.og_description).trim()) || undefined,
    h1: `${course.name} — Online Coaching`,
    lead: truncate(baseDesc, 240),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.name,
        description: truncate(baseDesc, 300),
        provider: {
          "@type": "EducationalOrganization",
          name: SITE_NAME,
          url: SITE_URL,
        },
        url: canonical,
        ...(ogImage !== DEFAULT_OG ? { image: ogImage } : {}),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Programs", item: `${SITE_URL}/programs` },
          { "@type": "ListItem", position: 3, name: course.name, item: canonical },
        ],
      },
    ],
  };
}

function buildSubjectMeta(subject: any, path: string): RouteMeta {
  const canonical = `${SITE_URL}${path}`;
  const desc = truncate(
    subject.description ||
      `Learn ${subject.name} online with video lectures, chapter-wise notes, MCQ practice and AI doubt solver. Aligned to NEET, JEE & board syllabi.`
  );
  const ogImage =
    subject.thumbnail_url && !subject.thumbnail_url.startsWith("data:")
      ? subject.thumbnail_url
      : DEFAULT_OG;
  return {
    title: `${subject.name} Online Classes & Video Lectures`,
    description: desc,
    keywords: `${subject.name} online classes, ${subject.name} video lectures, ${subject.name} notes, ${subject.name} MCQ, ${SITE_NAME}`,
    canonical,
    ogImage,
    ogType: "website",
    h1: `${subject.name} Online Classes`,
    lead: truncate(subject.description || desc, 240),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Subjects", item: `${SITE_URL}/programs` },
          { "@type": "ListItem", position: 3, name: subject.name, item: canonical },
        ],
      },
    ],
  };
}

function buildBlogMeta(post: any, path: string): RouteMeta {
  const canonical = `${SITE_URL}${path}`;
  const desc = truncate(post.meta_description || post.title);
  const ogImage = post.featured_image_url || DEFAULT_OG;
  return {
    title: post.title,
    description: desc,
    canonical,
    ogImage,
    ogType: "article",
    h1: post.title,
    lead: truncate(post.meta_description || post.title, 240),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: desc,
        url: canonical,
        ...(post.featured_image_url ? { image: post.featured_image_url } : {}),
        ...(post.created_at ? { datePublished: post.created_at } : {}),
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
        },
      },
    ],
  };
}

// ─── Path routing ────────────────────────────────────────────────────────

interface PathMatch {
  kind: "course" | "subject" | "blog";
  slug: string;
  path: string;
}

function matchPath(input: string): PathMatch | null {
  // Normalize: strip trailing slash (except root) and query string.
  let path = input.split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/course\/([^/]+)(?:\/preview)?$/))) {
    return { kind: "course", slug: m[1], path };
  }
  if ((m = path.match(/^\/programs\/([^/]+)$/))) {
    // Legacy course detail. We ignore deeper /programs/:a/:b category routes.
    return { kind: "course", slug: m[1], path };
  }
  if ((m = path.match(/^\/subject\/([^/]+)$/))) {
    return { kind: "subject", slug: m[1], path };
  }
  if ((m = path.match(/^\/learn\/([^/]+)$/))) {
    return { kind: "subject", slug: m[1], path };
  }
  if ((m = path.match(/^\/blog\/([^/]+)$/))) {
    return { kind: "blog", slug: m[1], path };
  }
  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";
  const match = matchPath(path);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const shell = await getShell();
  let html = shell;

  try {
    if (match) {
      if (match.kind === "course") {
        const { data } = await supabase
          .from("courses")
          .select("name, slug, short_description, thumbnail_url, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, seo_canonical_url")
          .eq("slug", match.slug)
          .eq("is_active", true)
          .maybeSingle();
        if (data) html = rewriteShell(shell, buildCourseMeta(data, `/course/${data.slug}`));
      } else if (match.kind === "subject") {
        const { data } = await supabase
          .from("popular_subjects")
          .select("name, slug, description, thumbnail_url")
          .eq("slug", match.slug)
          .maybeSingle();
        if (data) html = rewriteShell(shell, buildSubjectMeta(data, `/subject/${data.slug}`));
      } else if (match.kind === "blog") {
        const { data } = await supabase
          .from("blog_posts")
          .select("title, slug, meta_description, featured_image_url, created_at")
          .eq("slug", match.slug)
          .eq("status", "published")
          .maybeSingle();
        if (data) html = rewriteShell(shell, buildBlogMeta(data, `/blog/${data.slug}`));
      }
    }
  } catch (e) {
    console.error("seo-head lookup failed:", e);
  }

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "X-SEO-Head": match ? `${match.kind}:${match.slug}` : "shell",
    },
  });
});
