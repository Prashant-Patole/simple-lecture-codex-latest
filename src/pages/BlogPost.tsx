import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { goHome } from "@/lib/goHome";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, BookOpen, Share2, Link as LinkIcon, Clock, Hash } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";

interface BlogSection {
  heading: string;
  content: string;
  image_url: string | null;
}

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  keywords: string[];
  sections: BlogSection[];
  featured_image_url: string | null;
  published_at: string;
  course_id: string | null;
  courses?: { name: string; slug: string } | null;
}

const SECTION_COLORS = [
  "from-primary/20 to-primary/5",
  "from-accent/20 to-accent/5",
  "from-primary/15 via-accent/10 to-primary/5",
  "from-accent/15 to-primary/10",
  "from-primary/10 to-accent/15",
  "from-accent/10 via-primary/5 to-accent/5",
];

const SECTION_ICONS = ["📖", "🎯", "💡", "🚀", "📝", "✨"];

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, courses(name, slug)")
        .eq("slug", slug!)
        .eq("status", "published")
        .single();
      if (error) throw error;
      return data as unknown as BlogPostData;
    },
    enabled: !!slug,
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background">
          <div className="animate-pulse">
            <div className="h-[360px] bg-muted" />
            <div className="container mx-auto px-4 max-w-4xl py-12 space-y-8">
              <div className="h-10 bg-muted rounded-lg w-3/4" />
              <div className="h-5 bg-muted rounded w-1/3" />
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-2">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Post not found</h1>
            <Link to="/blog">
              <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const sections = (Array.isArray(post.sections) ? post.sections : []) as BlogSection[];
  const wordCount = sections.reduce((acc, s) => acc + (s.content?.split(/\s+/).length || 0), 0);
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const structuredData = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.meta_description,
    "image": post.featured_image_url || undefined,
    "datePublished": post.published_at,
    "author": { "@type": "Organization", "name": "SimpleLecture" },
    "publisher": { "@type": "Organization", "name": "SimpleLecture" },
    "keywords": post.keywords?.join(", "),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${typeof window !== 'undefined' ? window.location.origin : 'https://simplelecture.com'}/blog/${post.slug}`,
    },
  }), [post.slug, post.title, post.published_at, post.featured_image_url, post.meta_description, post.keywords]);

  return (
    <>
      <SEOHead
        title={post.title}
        description={post.meta_description || ""}
        keywords={post.keywords?.join(", ")}
        canonicalUrl={`https://simplelecture.com/blog/${post.slug}`}
        ogImage={post.featured_image_url || undefined}
        preloadImage={post.featured_image_url || undefined}
        ogType="article"
        structuredData={structuredData}
      />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative">
          {post.featured_image_url ? (
            <div className="relative h-[320px] md:h-[420px] overflow-hidden">
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
                decoding="async"
                {...({ fetchpriority: 'high' } as any)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
            </div>
          ) : (
            <div className="h-[200px] md:h-[280px] bg-gradient-to-br from-primary/10 via-background to-accent/10" />
          )}

          <div className="container mx-auto px-4 max-w-4xl relative z-10" style={{ marginTop: post.featured_image_url ? '-120px' : '-60px' }}>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
              <Link to="/" onClick={(e) => { e.preventDefault(); goHome(navigate); }} className="hover:text-foreground transition-colors">Home</Link>
              <span className="opacity-40">/</span>
              <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
              <span className="opacity-40">/</span>
              <span className="text-foreground/70 line-clamp-1">{post.title}</span>
            </nav>

            <header className="mb-10">
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-5 leading-[1.15] tracking-tight">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.published_at), "MMMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {readingTime} min read
                </span>
                {post.courses && (
                  <Link to={`/course/${post.courses.slug}`}>
                    <Badge variant="secondary" className="hover:bg-primary/10 transition-colors">
                      <BookOpen className="h-3 w-3 mr-1" />
                      {post.courses.name}
                    </Badge>
                  </Link>
                )}
              </div>
            </header>
          </div>
        </div>

        <article className="container mx-auto px-4 max-w-4xl pb-16">
          {/* Table of Contents */}
          {sections.length > 2 && (
            <div className="mb-12 p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" /> In this article
              </h3>
              <nav className="space-y-1.5">
                {sections.map((section, i) => (
                  <a
                    key={i}
                    href={`#section-${i}`}
                    className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1 pl-3 border-l-2 border-transparent hover:border-primary"
                  >
                    {section.heading}
                  </a>
                ))}
              </nav>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-14">
            {sections.map((section, i) => (
              <section key={i} id={`section-${i}`} className="scroll-mt-24">
                {/* Section divider */}
                {i > 0 && (
                  <div className="flex items-center gap-4 mb-8">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    <span className="text-lg">{SECTION_ICONS[i % SECTION_ICONS.length]}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                )}

                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-5 leading-tight">
                  {section.heading}
                </h2>

                {/* Section image or styled placeholder */}
                {section.image_url ? (
                  <div className="relative rounded-xl overflow-hidden mb-6 shadow-sm">
                    <img
                      src={section.image_url}
                      alt={section.heading}
                      className="w-full h-auto max-h-[400px] object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className={`rounded-xl mb-6 h-48 md:h-56 bg-gradient-to-br ${SECTION_COLORS[i % SECTION_COLORS.length]} flex items-center justify-center`}>
                    <span className="text-5xl opacity-50">{SECTION_ICONS[i % SECTION_ICONS.length]}</span>
                  </div>
                )}

                <div className="text-base md:text-lg text-muted-foreground leading-[1.8] whitespace-pre-line">
                  {i === 0 ? (
                    <>
                      <span className="text-4xl font-bold text-foreground float-left mr-3 mt-1 leading-none">
                        {section.content.charAt(0)}
                      </span>
                      {section.content.slice(1)}
                    </>
                  ) : (
                    section.content
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* Keywords */}
          {post.keywords && post.keywords.length > 0 && (
            <div className="mt-14 pt-8 border-t border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Topics</h3>
              <div className="flex flex-wrap gap-2">
                {post.keywords.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs px-3 py-1 hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-default"
                  >
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="mt-8 flex items-center gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Share2 className="h-4 w-4" /> Share
            </span>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="text-xs">
              <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>

          {/* Course CTA */}
          {post.courses && (
            <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-primary/5 via-card to-accent/5 border border-primary/15 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Interested in {post.courses.name}?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    Explore the full curriculum, live classes, AI tutoring, and more on SimpleLecture.
                  </p>
                  <Link to={`/course/${post.courses.slug}`}>
                    <Button size="lg">View Course Details <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Back */}
          <div className="mt-12">
            <Link to="/blog">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> All Blog Posts
              </Button>
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
};

export default BlogPost;
