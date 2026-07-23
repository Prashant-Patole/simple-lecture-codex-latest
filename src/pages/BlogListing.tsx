import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  keywords: string[];
  featured_image_url: string | null;
  published_at: string;
  course_id: string | null;
  courses?: { name: string; slug: string } | null;
}

const BlogListing = () => {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, meta_description, keywords, featured_image_url, published_at, course_id, courses(name, slug)")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BlogPost[];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "SimpleLecture Blog",
    "description": "Expert educational insights, study tips, and course guides from SimpleLecture",
    "url": `${window.location.origin}/blog`,
  };

  const featuredPost = posts?.[0];
  const remainingPosts = posts?.slice(1) || [];

  return (
    <>
      <SEOHead
        title="Blog - Educational Insights & Study Tips"
        description="Expert educational insights, study tips, exam strategies, and course guides. Stay updated with SimpleLecture's latest learning resources."
        keywords="education blog, study tips, exam preparation, online learning, SimpleLecture"
        canonicalUrl="https://simplelecture.com/blog"
        structuredData={structuredData}
      />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/8" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="container mx-auto px-4 max-w-6xl relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary uppercase tracking-wider">SimpleLecture Blog</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-5 tracking-tight leading-[1.1]">
              Insights for<br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Smarter Learning</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Expert strategies, in-depth guides, and actionable tips to help you ace your exams and master every subject.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            {isLoading ? (
              <div className="space-y-8">
                <div className="h-[400px] rounded-2xl bg-muted animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-72 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-10">
                {/* Featured Post */}
                {featuredPost && (
                  <Link to={`/blog/${featuredPost.slug}`} className="group block">
                    <article className="relative rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm hover:shadow-xl transition-all duration-500">
                      <div className="grid md:grid-cols-2">
                        <div className="relative h-64 md:h-[420px] overflow-hidden">
                          {featuredPost.featured_image_url ? (
                            <img
                              src={featuredPost.featured_image_url}
                              alt={featuredPost.title}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              decoding="async"
                              {...({ fetchpriority: 'high' } as any)}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center">
                              <BookOpen className="h-16 w-16 text-primary/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
                        </div>
                        <div className="p-8 md:p-10 flex flex-col justify-center">
                          <div className="flex items-center gap-3 mb-4">
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">Featured</Badge>
                            {featuredPost.courses && (
                              <Badge variant="secondary" className="text-xs">{featuredPost.courses.name}</Badge>
                            )}
                          </div>
                          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight group-hover:text-primary transition-colors duration-300">
                            {featuredPost.title}
                          </h2>
                          <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
                            {featuredPost.meta_description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(featuredPost.published_at), "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-3 transition-all duration-300">
                              Read article <ArrowRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                )}

                {/* Remaining Posts Grid */}
                {remainingPosts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {remainingPosts.map((post) => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
                        <article className="h-full rounded-xl overflow-hidden border border-border/40 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-400">
                          <div className="relative h-52 overflow-hidden">
                            {post.featured_image_url ? (
                              <img
                                src={post.featured_image_url}
                                alt={post.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 flex items-center justify-center">
                                <BookOpen className="h-10 w-10 text-primary/25" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          <div className="p-6 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(post.published_at), "MMM d, yyyy")}
                              {post.courses && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {post.courses.name}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-snug">
                              {post.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {post.meta_description}
                            </p>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-primary pt-1 group-hover:gap-3 transition-all duration-300">
                              Read more <ArrowRight className="h-4 w-4" />
                            </div>
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                  <BookOpen className="h-10 w-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">No posts yet</h2>
                <p className="text-muted-foreground">Fresh content is on the way — check back soon!</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default BlogListing;
