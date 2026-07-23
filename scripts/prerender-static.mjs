#!/usr/bin/env node
/**
 * Build-time static-route prerenderer.
 *
 * Why this exists:
 *   Vite emits a single `dist/index.html` with a generic <title> and meta tags.
 *   When a crawler (or social-share preview) fetches `/programs`, `/blog`,
 *   `/about`, etc., it gets that generic HTML — same title, same description —
 *   and the per-page meta only fills in *after* React runs. Many crawlers and
 *   social previews don't run JS, so they index every URL identically.
 *
 * What it does:
 *   For each static route below, this script:
 *     1. Creates `dist/<route>/index.html` from the base shell.
 *     2. Rewrites <title>, the meta description / keywords / OG / Twitter
 *        tags, the canonical link, and injects a JSON-LD block.
 *     3. Drops a small <noscript> body fallback so crawlers without JS still
 *        see a meaningful H1 + paragraph.
 *
 *   Apache's RewriteCond in public/.htaccess will serve these prerendered
 *   files in preference to the SPA shell. Real users still get the SPA — it
 *   hydrates on top of the prerendered HTML, so the experience is unchanged.
 *
 * Why no browser:
 *   Static routes have static meta. We don't need to spin up Chromium and
 *   render React just to inject six known strings into the head. Pure Node +
 *   string rewriting keeps the dep tree tiny and the build fast.
 *
 * For dynamic routes (/course/:slug, /blog/:slug, /subject/:slug,
 * /explore/:slug) we rely on Googlebot's and Bingbot's JS execution — both
 * search engines have run JS since 2019, and Phase 1 of the SEO work already
 * ensured every page sets a proper canonical, title, description, and JSON-LD
 * via react-helmet-async.
 */

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const SHELL_PATH = join(DIST, "index.html");

const SITE_URL = "https://simplelecture.com";
const SITE_NAME = "SimpleLecture";
const DEFAULT_OG = `${SITE_URL}/og-default.png`;
const DEFAULT_KEYWORDS =
  "AI tutoring, online learning, NEET, JEE, SSLC, PUC, board exams, entrance exams, India";

// Supabase REST — used at build time to enumerate dynamic routes. Anon key is
// publishable (also shipped in the client bundle), so embedding it here is safe.
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://oxwhqvsoelqqsblmqkxx.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94d2hxdnNvZWxxcXNibG1xa3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTU4NTgsImV4cCI6MjA3NTA5MTg1OH0.nZbWSb9AQK5uGAQmc7zXAceTHm9GRQJvqkg4-LNo_DM";

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}`);
  return res.json();
}

function truncate(str, n = 155) {
  if (!str) return "";
  const clean = String(str).replace(/[#*_`>\n\r]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

// ─── Routes to prerender ─────────────────────────────────────────────────
// Each entry produces dist/<path>/index.html (path "/" → dist/index.html
// is overwritten in place). Keep entries short and deterministic.

/**
 * @typedef {{
 *   path: string,
 *   title: string,
 *   description: string,
 *   keywords?: string,
 *   ogImage?: string,
 *   ogType?: "website" | "article",
 *   h1: string,
 *   lead: string,
 *   jsonLd?: object[],
 * }} StaticRoute
 */

/** @type {StaticRoute[]} */
const ROUTES = [
  {
    path: "/",
    title: "AI Learning for Board & Entrance Exams",
    description:
      "Score 90+ in SSLC, PUC, NEET & JEE with AI tutors available 24/7. Personalised learning at ₹1000/year. Join 50,000+ students. Start free today.",
    keywords: DEFAULT_KEYWORDS,
    h1: "AI Learning for Board & Entrance Exams",
    lead:
      "India's first AI-powered learning platform for SSLC, PUC, NEET, JEE and skill development. 24/7 AI tutors, mastery-based learning, ₹1000/year.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description:
          "India's first AI-powered learning platform for board exams, entrance tests, and skill development. Courses starting at ₹1000/year.",
        foundingDate: "2024",
        areaServed: "IN",
        telephone: "+917353021234",
        email: "contact@simplelecture.com",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Koramangala, Bangalore",
          addressRegion: "Karnataka",
          addressCountry: "IN",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/programs?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  },
  {
    path: "/programs",
    title: "All Programs",
    description:
      "Explore all SimpleLecture programs — SSLC, PUC, NEET, JEE, and skill courses with 24/7 AI tutors. Find the right course for your goal.",
    keywords:
      "online courses, SSLC, PUC, NEET, JEE, skill development, all programs",
    h1: "All Programs",
    lead:
      "Browse every SimpleLecture program in one place — board exams, entrance preparation, and skill courses, each with 24/7 AI tutors.",
  },
  {
    path: "/blog",
    title: "Blog – Educational Insights & Study Tips",
    description:
      "Expert educational insights, study tips, exam strategies and course guides. Stay updated with SimpleLecture's latest learning resources.",
    keywords: "education blog, study tips, exam preparation, SimpleLecture",
    h1: "SimpleLecture Blog",
    lead:
      "Study tips, exam strategies, and course guides from the SimpleLecture team.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "SimpleLecture Blog",
        url: `${SITE_URL}/blog`,
      },
    ],
  },
  {
    path: "/about",
    title: "About Us",
    description:
      "Learn about SimpleLecture — India's AI-powered learning platform helping students score 90+ in board and entrance exams.",
    h1: "About SimpleLecture",
    lead:
      "We build AI tutors that help students master board exams, NEET, JEE and skill subjects — affordably and at scale.",
  },
  {
    path: "/contact",
    title: "Contact Us",
    description:
      "Get in touch with the SimpleLecture team. Call +91 7353021234 or email contact@simplelecture.com.",
    h1: "Contact SimpleLecture",
    lead:
      "Reach our team for course questions, support, or partnership enquiries.",
  },
  {
    path: "/support",
    title: "Support",
    description:
      "Find answers to common questions or open a ticket with the SimpleLecture support team.",
    h1: "Support",
    lead:
      "Browse our help articles or open a support ticket — we usually respond within a few hours.",
  },
  {
    path: "/terms",
    title: "Terms and Conditions",
    description:
      "SimpleLecture's terms of service governing use of the platform, courses and AI tutors.",
    h1: "Terms and Conditions",
    lead: "The agreement between SimpleLecture and our users.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "How SimpleLecture collects, uses, and protects your personal data.",
    h1: "Privacy Policy",
    lead:
      "How we handle student data, account information, and analytics across the platform.",
  },
  {
    path: "/forum",
    title: "Community Forum",
    description:
      "Ask questions, share notes, and get help from fellow students in the SimpleLecture community forum.",
    h1: "SimpleLecture Forum",
    lead:
      "A community for SimpleLecture students — ask doubts, share notes, and learn together.",
  },
];

// ─── HTML rewriting helpers ──────────────────────────────────────────────

const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Replace the head of dist/index.html with route-specific meta. We do this by
 * string operations on known patterns rather than a real HTML parser — Vite's
 * output is stable enough that a few regexes are reliable, and we don't need
 * a 2 MB parser dep just for this.
 */
function rewriteShell(shell, route) {
  const canonical = SITE_URL + (route.path === "/" ? "/" : route.path);
  const title = `${route.title} | ${SITE_NAME}`;
  const ogType = route.ogType ?? "website";
  const ogImage = route.ogImage ?? DEFAULT_OG;

  let html = shell;

  // <title>…</title>
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escHtml(title)}</title>`
  );

  // meta name="description"
  html = replaceMeta(html, "name", "description", route.description);
  // meta name="keywords"
  if (route.keywords) {
    html = replaceMeta(html, "name", "keywords", route.keywords);
  }
  // canonical link
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escAttr(canonical)}" />`
  );

  // OG tags
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", route.description);
  html = replaceMeta(html, "property", "og:type", ogType);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "property", "og:image", ogImage);

  // Twitter tags
  html = replaceMeta(html, "name", "twitter:title", title);
  html = replaceMeta(html, "name", "twitter:description", route.description);
  html = replaceMeta(html, "name", "twitter:image", ogImage);

  // Append JSON-LD just before </head>. We drop any existing JSON-LD block
  // first so duplicates don't appear (Vite's index.html ships one for the
  // homepage by default).
  if (route.jsonLd && route.jsonLd.length) {
    html = html.replace(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
      ""
    );
    const scripts = route.jsonLd
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

  // <noscript> H1 + paragraph fallback inside #root. Replaces the loading
  // spinner shell so crawlers without JS still see meaningful content.
  const fallback = `
      <noscript>
        <article style="max-width:760px;margin:2rem auto;padding:1rem;font-family:system-ui,sans-serif;">
          <h1>${escHtml(route.h1)}</h1>
          <p>${escHtml(route.lead)}</p>
          <p><a href="${escAttr(canonical)}">Open SimpleLecture →</a></p>
        </article>
      </noscript>
      <div data-seo-fallback="1" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">
        <h1>${escHtml(route.h1)}</h1>
        <p>${escHtml(route.lead)}</p>
      </div>`;

  // Insert the fallback just before the closing </div> of #root, but only if
  // it isn't already there (prerender script can run twice safely).
  if (!html.includes('data-seo-fallback="1"')) {
    html = html.replace(/<\/div>\s*<style>/i, `${fallback}\n    </div>\n    <style>`);
  }

  return html;
}

/** Replace (or insert) a single <meta> tag matching attr=key. */
function replaceMeta(html, attr, key, value) {
  const re = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*>`,
    "i"
  );
  const tag = `<meta ${attr}="${key}" content="${escAttr(value)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  // Not present in shell → insert before </head>.
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

// ─── Main ────────────────────────────────────────────────────────────────

async function buildDynamicRoutes() {
  /** @type {StaticRoute[]} */
  const out = [];

  // Courses → /course/:slug
  try {
    const courses = await sbFetch(
      "courses?select=slug,name,short_description,thumbnail_url,seo_title,seo_description,seo_keywords,og_title,og_description,og_image_url,seo_canonical_url&is_active=eq.true&order=sequence_order.asc&limit=2000"
    );
    for (const c of courses) {
      if (!c.slug) continue;
      const baseDesc =
        (c.seo_description && String(c.seo_description).trim()) ||
        c.short_description ||
        `${c.name} — online coaching with live classes, recorded video lectures, AI doubt solver and mock tests on SimpleLecture.`;
      const desc = truncate(baseDesc, 158);
      const title =
        (c.seo_title && String(c.seo_title).trim()) ||
        `${c.name} — Online Coaching & Live Classes`;
      const keywords =
        (c.seo_keywords && String(c.seo_keywords).trim()) ||
        `${c.name}, ${c.name} online coaching, ${c.name} video lectures, ${c.name} mock test, SimpleLecture`;
      const canonical =
        (c.seo_canonical_url && String(c.seo_canonical_url).trim()) ||
        `${SITE_URL}/course/${c.slug}`;
      const ogImage =
        (c.og_image_url && String(c.og_image_url).trim()) ||
        c.thumbnail_url ||
        undefined;
      out.push({
        path: `/course/${c.slug}`,
        title,
        description: desc,
        keywords,
        ogType: "website",
        ...(ogImage ? { ogImage } : {}),
        canonical,
        h1: `${c.name} — Online Coaching`,
        lead: truncate(baseDesc, 240),
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: c.name,
            description: truncate(baseDesc, 300),
            provider: {
              "@type": "EducationalOrganization",
              name: SITE_NAME,
              url: SITE_URL,
            },
            url: canonical,
            ...(ogImage ? { image: ogImage } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Programs", item: `${SITE_URL}/programs` },
              { "@type": "ListItem", position: 3, name: c.name, item: canonical },
            ],
          },
        ],
      });
    }
    console.log(`[prerender] courses: ${courses.length}`);
  } catch (e) {
    console.warn(`[prerender] skipping courses:`, e.message);
  }

  // Subjects → /subject/:slug
  try {
    const subjects = await sbFetch(
      "popular_subjects?select=slug,name&limit=2000"
    );
    for (const s of subjects) {
      if (!s.slug) continue;
      const desc = `Learn ${s.name} online with video lectures, chapter-wise notes, MCQ practice and AI doubt solver. Aligned to NEET, JEE & board syllabi.`;
      out.push({
        path: `/subject/${s.slug}`,
        title: `${s.name} Online Classes & Video Lectures`,
        description: truncate(desc, 158),
        keywords: `${s.name} online classes, ${s.name} video lectures, ${s.name} notes, ${s.name} MCQ, SimpleLecture`,
        h1: `${s.name} Online Classes`,
        lead: desc,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Subjects", item: `${SITE_URL}/programs` },
              { "@type": "ListItem", position: 3, name: s.name, item: `${SITE_URL}/subject/${s.slug}` },
            ],
          },
        ],
      });
    }
    console.log(`[prerender] subjects: ${subjects.length}`);
  } catch (e) {
    console.warn(`[prerender] skipping subjects:`, e.message);
  }

  // Blog posts → /blog/:slug
  try {
    const posts = await sbFetch(
      "blog_posts?select=slug,title,meta_description,featured_image_url,created_at&status=eq.published&limit=5000"
    );
    for (const p of posts) {
      if (!p.slug) continue;
      const desc = truncate(p.meta_description || p.title, 158);
      out.push({
        path: `/blog/${p.slug}`,
        title: p.title,
        description: desc,
        ogType: "article",
        ogImage: p.featured_image_url || DEFAULT_OG,
        h1: p.title,
        lead: desc,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: p.title,
            description: desc,
            image: p.featured_image_url || DEFAULT_OG,
            datePublished: p.created_at,
            author: { "@type": "Organization", name: SITE_NAME },
            publisher: {
              "@type": "Organization",
              name: SITE_NAME,
              logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
            },
            mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
              { "@type": "ListItem", position: 3, name: p.title, item: `${SITE_URL}/blog/${p.slug}` },
            ],
          },
        ],
      });
    }
    console.log(`[prerender] blog posts: ${posts.length}`);
  } catch (e) {
    console.warn(`[prerender] skipping blog:`, e.message);
  }

  // Explore-by-goal → /explore/:slug
  try {
    const goals = await sbFetch(
      "explore_by_goal?select=slug,name,description&is_active=eq.true&limit=200"
    );
    for (const g of goals) {
      if (!g.slug) continue;
      const desc = truncate(g.description || `${g.name} — curated courses, video lectures and mock tests on SimpleLecture.`, 158);
      out.push({
        path: `/explore/${g.slug}`,
        title: `${g.name} — Courses & Preparation`,
        description: desc,
        h1: g.name,
        lead: desc,
      });
    }
    console.log(`[prerender] explore goals: ${goals.length}`);
  } catch (e) {
    console.warn(`[prerender] skipping explore:`, e.message);
  }

  // Programmatic landing pages → /learn/:slug. We parse landingPages.ts with a
  // light regex to avoid loading a TS file at Node runtime.
  try {
    const lpSrc = await readFile(
      join(ROOT, "src/lib/seo/landingPages.ts"),
      "utf8"
    );
    const slugs = Array.from(lpSrc.matchAll(/slug:\s*["']([a-z0-9-]+)["']/g)).map((m) => m[1]);
    const titles = Array.from(lpSrc.matchAll(/title:\s*["'`]([^"'`]+)["'`]/g)).map((m) => m[1]);
    const descs = Array.from(lpSrc.matchAll(/description:\s*\n?\s*["'`]([^"'`]+)["'`]/g)).map((m) => m[1]);
    const h1s = Array.from(lpSrc.matchAll(/h1:\s*["'`]([^"'`]+)["'`]/g)).map((m) => m[1]);

    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const title = titles[i] || `${slug} | SimpleLecture`;
      const desc = descs[i] || `${slug} — online coaching on SimpleLecture.`;
      const h1 = h1s[i] || title;
      out.push({
        path: `/learn/${slug}`,
        title,
        description: truncate(desc, 158),
        h1,
        lead: truncate(desc, 240),
      });
    }
    console.log(`[prerender] landing pages: ${slugs.length}`);
  } catch (e) {
    console.warn(`[prerender] skipping landing pages:`, e.message);
  }

  return out;
}

async function main() {
  if (!existsSync(SHELL_PATH)) {
    console.error(
      `[prerender] dist/index.html not found. Run \`vite build\` first.`
    );
    process.exit(1);
  }

  const shell = await readFile(SHELL_PATH, "utf8");
  const dynamic = await buildDynamicRoutes();
  const allRoutes = [...ROUTES, ...dynamic];
  let wrote = 0;

  for (const route of allRoutes) {
    try {
      const html = rewriteShell(shell, route);
      const outPath =
        route.path === "/"
          ? SHELL_PATH
          : join(DIST, route.path.replace(/^\//, ""), "index.html");

      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, html, "utf8");
      wrote++;
    } catch (err) {
      console.warn(`[prerender] failed ${route.path}:`, err.message);
    }
  }

  // Copy .htaccess from public/ into dist/ if Vite didn't (it usually does,
  // but belt-and-braces in case it's missed).
  const srcHt = join(ROOT, "public", ".htaccess");
  const dstHt = join(DIST, ".htaccess");
  if (existsSync(srcHt) && !existsSync(dstHt)) {
    await copyFile(srcHt, dstHt);
    console.log(`[prerender] copied public/.htaccess → dist/.htaccess`);
  }

  console.log(`[prerender] done — wrote ${wrote} pages.`);
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
