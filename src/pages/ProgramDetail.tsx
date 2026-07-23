import { lazy, Suspense, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { goHome } from "@/lib/goHome";
import { rewriteStorageUrl } from "@/lib/proxyUrl";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Star, 
  GraduationCap,
  ShoppingCart,
  CheckCircle,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Play,
} from "lucide-react";
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from "@/utils/videoUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomNav } from "@/components/mobile/BottomNav";
import { generateCourseSchema, generateBreadcrumbSchema, generateFAQSchema } from "@/lib/seo/structuredData";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { SmartHeader } from "@/components/SmartHeader";
import { Footer } from "@/components/Footer";
import { FreePreviewCard } from "@/components/course/FreePreviewCard";
import { useCourseFreeAccess } from "@/hooks/useCourseFreeAccess";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy-load heavy below-the-fold components so they don't bloat the initial chunk
const CourseAIContentSection = lazyWithRetry(() =>
  import("@/components/course/CourseAIContentSection").then(m => ({ default: m.CourseAIContentSection }))
);
const CourseTrustSection = lazyWithRetry(() =>
  import("@/components/course/CourseTrustSection").then(m => ({ default: m.CourseTrustSection }))
);
const CourseBelowFold = lazyWithRetry(() => import("@/components/course/CourseBelowFold"));
const CourseDemoPlayer = lazyWithRetry(() =>
  import("@/components/program/CourseDemoPlayer").then(m => ({ default: m.CourseDemoPlayer }))
);

/** YouTube facade – shows thumbnail + play button, loads iframe on click */
const YouTubeFacade = ({ videoId, title, className }: { videoId: string; title: string; className?: string }) => {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        src={getYouTubeEmbedUrl(videoId, true)}
        className={className || "w-full h-full"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title}
      />
    );
  }

  return (
    <button
      onClick={() => setLoaded(true)}
      className="relative w-full h-full group cursor-pointer bg-black"
      aria-label={`Play ${title}`}
    >
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover"
        width={480}
        height={360}
        loading="eager"
        {...({ fetchpriority: 'high' } as any)}
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
          <Play className="h-7 w-7 md:h-9 md:w-9 text-white fill-white ml-1" />
        </div>
      </div>
    </button>
  );
};

const ProgramDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: course, isLoading } = useQuery({
    queryKey: ["program-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_detail", { p_slug: slug! });
      if (error) throw error;
      return data as any;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Fires in PARALLEL with course query (gated on slug, not course.id) to remove waterfall.
  const { data: isEnrolledData } = useQuery({
    queryKey: ["enrollment-check-slug", slug],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;
      const { data, error } = await supabase.rpc("check_course_enrollment", { p_course_slug: slug! });
      if (error) return false;
      return !!data;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  const isEnrolled = !!isEnrolledData;

  const { data: freeChapters } = useCourseFreeAccess(course?.id);
  const freeChapterCount = freeChapters?.length || 0;

  if (isLoading) {
    if (isMobile) {
      return (
        <div className="min-h-screen bg-background">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mx-4 mt-4 h-48 rounded-xl" />
          <div className="px-4 mt-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <BottomNav />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col">
        <Suspense fallback={<div className="h-16 border-b" />}>
          <SmartHeader />
        </Suspense>
        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <Skeleton className="h-96 mb-8 rounded-xl" />
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-96" />
              </div>
              <Skeleton className="h-[600px]" />
            </div>
          </div>
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    );
  }

  if (!course) {
    if (isMobile) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <button onClick={() => navigate("/programs")} className="p-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold">Not Found</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="space-y-3">
              <h1 className="text-xl font-bold">Program Not Found</h1>
              <p className="text-sm text-muted-foreground">The program you're looking for doesn't exist.</p>
              <Button size="sm" onClick={() => navigate("/programs")}>Browse Programs</Button>
            </div>
          </div>
          <BottomNav />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col">
        <Suspense fallback={<div className="h-16 border-b" />}>
          <SmartHeader />
        </Suspense>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Program Not Found</h1>
            <p className="text-muted-foreground text-lg">The program you're looking for doesn't exist.</p>
            <Button asChild size="lg">
              <Link to="/programs">Browse All Programs</Link>
            </Button>
          </div>
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    );
  }

  const subjectOrderMap = new Map<string, number>(
    (course.course_subjects || []).map((cs: any) => [cs.popular_subjects?.id || cs.subject_id, cs.display_order ?? 0])
  );
  const subjects = (course.course_subjects || [])
    .map((cs: any) => cs.popular_subjects)
    .filter(Boolean)
    .sort((a: any, b: any) => (subjectOrderMap.get(a.id) ?? 0) - (subjectOrderMap.get(b.id) ?? 0));

  const categories = course.course_categories?.map((cc: any) => cc.categories).filter(Boolean) || [];
  const faqs = course.course_faqs?.sort((a: any, b: any) => a.display_order - b.display_order) || [];

  const learningPoints = course.what_you_learn ? 
    (Array.isArray(course.what_you_learn) ? course.what_you_learn : []) : [];
  
  const courseIncludes = course.course_includes ? 
    (Array.isArray(course.course_includes) ? course.course_includes : []) : [];

  const promoVideoUrl = (course as any).promotional_video_url;
  const videoId = promoVideoUrl ? extractYouTubeVideoId(promoVideoUrl) : null;
  const ct = (course as any).course_thumbnails;
  const storageUrl = Array.isArray(ct) ? ct[0]?.storage_url : ct?.storage_url;
  const rawThumbnail = storageUrl || (course.thumbnail_url && !course.thumbnail_url.startsWith("data:") ? course.thumbnail_url : null);
  const bannerThumbnail = rewriteStorageUrl(rawThumbnail);

  const canonicalCourseUrl = `https://simplelecture.com/course/${course.slug}`;
  const subjectListForMeta = subjects.slice(0, 3).map((s: any) => s.name).join(", ");
  const courseMetaDescription =
    course.short_description?.trim() ||
    `${course.name} — online coaching with live classes, recorded video lectures, AI doubt solver & mock tests${subjectListForMeta ? ` covering ${subjectListForMeta}` : ''}${course.price_inr ? `. Starting at ₹${course.price_inr.toLocaleString()}` : ''}${course.student_count ? `. Joined by ${course.student_count.toLocaleString()}+ students.` : '.'} Enroll today.`;
  const courseSeoTitle = `${course.name} | Online Coaching & Live Classes`;
  const courseKeywords = `${course.name}, ${course.name} online coaching, ${course.name} online classes, ${subjectListForMeta ? subjectListForMeta + ' online classes, ' : ''}online lectures, live classes, mock test series, AI doubt solver, video lectures, online learning India`;

  const courseStructuredData = useMemo(() => ({
    "@context": "https://schema.org",
    "@graph": [
      generateCourseSchema({
        name: course.name,
        description: course.short_description || course.detailed_description || `Learn ${course.name} with AI`,
        rating: course.rating,
        studentCount: course.student_count,
        duration: course.duration_months,
        price: course.price_inr,
        originalPrice: course.original_price_inr,
        subjects: subjects.map((s: any) => s.name),
      }),
      generateBreadcrumbSchema([
        { name: "Home", url: "https://simplelecture.com/" },
        { name: "Programs", url: "https://simplelecture.com/programs" },
        { name: course.name, url: `https://simplelecture.com/course/${course.slug}` },
      ]),
      ...(faqs.length > 0 ? [generateFAQSchema(faqs.map((f: any) => ({ question: f.question, answer: f.answer })))] : []),
    ],
  }), [course.id, course.slug, faqs.length]);

  // ============ MOBILE LAYOUT ============
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-36">
        <SEOHead
          title={courseSeoTitle}
          description={courseMetaDescription}
          keywords={courseKeywords}
          canonicalUrl={canonicalCourseUrl}
          ogImage={rewriteStorageUrl(storageUrl || (course.thumbnail_url && !course.thumbnail_url.startsWith("data:") ? course.thumbnail_url : null)) || undefined}
          preloadImage={bannerThumbnail || undefined}
          structuredData={courseStructuredData}
        />

        {/* Mobile Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <button 
              onClick={() => navigate("/programs")} 
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 font-semibold text-sm line-clamp-1">{course.name}</h1>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav className="px-4 py-2 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 flex-wrap">
            <li><Link to="/" onClick={(e) => { e.preventDefault(); goHome(navigate); }} className="hover:text-foreground">Home</Link></li>
            <li><ChevronRight className="h-3 w-3 inline" /></li>
            <li><Link to="/programs" className="hover:text-foreground">Programs</Link></li>
            <li><ChevronRight className="h-3 w-3 inline" /></li>
            <li className="text-foreground font-medium truncate max-w-[200px]">{course.name}</li>
          </ol>
        </nav>

        {/* Video / Thumbnail – YouTube facade */}
        <div className="mx-4 mt-3">
          {videoId ? (
            <div className="aspect-video rounded-xl overflow-hidden shadow-md">
              <YouTubeFacade videoId={videoId} title={`${course.name} video`} className="w-full h-full" />
            </div>
          ) : bannerThumbnail ? (
            <img
              src={bannerThumbnail}
              alt={course.name}
              width={640}
              height={360}
              className="w-full aspect-video rounded-xl object-cover shadow-md"
              {...({ fetchpriority: 'high' } as any)}
            />
          ) : null}
        </div>

        {/* Course Info */}
        <div className="px-4 mt-4 space-y-3">
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat: any) => (
                <Badge key={cat.id} variant="secondary" className="text-[10px] px-2 py-0.5">
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}

          <h2 className="text-lg font-bold leading-snug">{course.name}</h2>

          {course.short_description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {stripMarkdown(course.short_description)}
            </p>
          )}

          {!isEnrolled && freeChapterCount > 0 && (
            <div className="-mx-4">
              <FreePreviewCard courseSlug={course.slug} chapterCount={freeChapterCount} />
            </div>
          )}


          {/* Stats row */}
          <div className="flex flex-wrap gap-2">
            {course.rating > 0 && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-semibold">{course.rating}</span>
              </div>
            )}
            {course.student_count > 0 && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-semibold">{course.student_count.toLocaleString()}</span>
              </div>
            )}
            {course.duration_months && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-semibold">{course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-4 mt-5 space-y-4">

          {/* Subjects You'll Master */}
          {subjects.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="flex items-center gap-2 font-bold text-base">
                <GraduationCap className="h-4 w-4 text-primary" />
                Subjects You'll Master
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {subjects.map((subject: any) => (
                  <Link
                    key={subject.id}
                    to={`/subject/${subject.slug}?course=${slug}`}
                    className="flex-shrink-0 w-36"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow border">
                      <CardContent className="p-3">
                        <div className="flex flex-col items-center text-center gap-2">
                          {rewriteStorageUrl(subject.thumbnail_url) ? (
                            <img
                              src={`${rewriteStorageUrl(subject.thumbnail_url)!}?width=96&height=96&resize=cover&quality=75`}
                              alt={subject.name}
                              width={48}
                              height={48}
                              loading="lazy"
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-6 w-6 text-primary" />
                            </div>
                          )}
                          <span className="text-xs font-semibold line-clamp-2">{subject.name}</span>
                          <div className="flex items-center gap-0.5 text-[10px] text-primary font-medium">
                            <span>Explore</span>
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* About This Program */}
          {course.detailed_description && (
            <Card className="border">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <BookOpen className="h-4 w-4 text-primary" />
                  About This Program
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {stripMarkdown(course.detailed_description)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Below-fold: What You'll Learn, Features, Includes, FAQs */}
          <Suspense fallback={null}>
            <CourseBelowFold
              learningPoints={learningPoints}
              courseIncludes={courseIncludes}
              faqs={faqs}
              isMobile={true}
            />

            {/* AI Content & Trust Sections */}
            <CourseAIContentSection
              courseName={course.name}
              category={course.category}
              whatYouLearn={learningPoints}
              price={course.price_inr}
              originalPrice={course.original_price_inr}
            />
            <CourseTrustSection rating={course.rating} studentCount={course.student_count} />
          </Suspense>

          <Card className="border">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm font-bold">Course Highlights</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="divide-y">
                {subjects.length > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground">Subjects</span>
                    <span className="text-xs font-semibold">{subjects.length}</span>
                  </div>
                )}
                {course.duration_months && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground">Duration</span>
                    <span className="text-xs font-semibold">{course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Students</span>
                  <span className="text-xs font-semibold">1,00,000+</span>
                </div>
                {course.rating > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground">Rating</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-semibold">{course.rating}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky Bottom CTA Bar */}
        <div className="fixed bottom-16 left-0 right-0 bg-background border-t shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-40 px-4 py-3">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div>
              {course.price_inr > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold">₹{course.price_inr.toLocaleString()}</span>
                  {course.original_price_inr && course.original_price_inr > course.price_inr && (
                    <span className="text-xs line-through text-muted-foreground">
                      ₹{course.original_price_inr.toLocaleString()}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-lg font-bold text-green-600">Free</span>
              )}
            </div>
            {isEnrolled ? (
              <Button 
                size="sm"
                className="px-6 bg-green-500 hover:bg-green-600 text-white shadow-md"
                onClick={() => navigate(`/learning/${course.id}`)}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Continue Learning
              </Button>
                  ) : course?.is_coming_soon ? (
                     <div className="flex flex-col items-center gap-2">
                       <Badge className="bg-amber-500 text-white py-2 px-4 text-sm font-semibold">Coming Soon</Badge>
                       <Button size="sm" variant="outline" className="text-xs" asChild>
                         <Link to="/course/Class-10">Explore SSLC Program →</Link>
                       </Button>
                     </div>
                  ) : (
              <Button size="sm" className="px-6 shadow-md" asChild>
                <Link to={`/enroll/${course.slug}`}>
                  Enroll Now
                </Link>
              </Button>
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ============ DESKTOP LAYOUT ============
  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={courseSeoTitle}
        description={courseMetaDescription}
        keywords={courseKeywords}
        canonicalUrl={canonicalCourseUrl}
        ogImage={rewriteStorageUrl(storageUrl || (course.thumbnail_url && !course.thumbnail_url.startsWith("data:") ? course.thumbnail_url : null)) || undefined}
        preloadImage={bannerThumbnail || undefined}
        structuredData={courseStructuredData}
      />
      <Suspense fallback={<div className="h-16 border-b" />}>
        <SmartHeader />
      </Suspense>

      <main className="flex-1">
        {/* Breadcrumb */}
        <nav className="container mx-auto px-4 py-3 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" onClick={(e) => { e.preventDefault(); goHome(navigate); }} className="hover:text-foreground transition-colors">Home</Link></li>
            <li><ChevronRight className="h-3.5 w-3.5 inline" /></li>
            <li><Link to="/programs" className="hover:text-foreground transition-colors">Programs</Link></li>
            <li><ChevronRight className="h-3.5 w-3.5 inline" /></li>
            <li className="text-foreground font-medium">{course.name}</li>
          </ol>
        </nav>

        {/* Hero Section with Gradient */}
        <section className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
          <div className="container mx-auto px-4 py-1 relative">
            <div className="grid lg:grid-cols-2 gap-4 items-center">
              {/* Left Content */}
              <div className="space-y-2">
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat: any) => (
                      <Badge key={cat.id} variant="secondary" className="text-xs px-2 py-0.5">
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
                  {course.name}
                </h1>
                
                {course.short_description && (
                  <p className="text-sm md:text-base opacity-90 leading-relaxed">
                    {stripMarkdown(course.short_description)}
                  </p>
                )}

                {subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center bg-white/10 rounded-lg px-2 py-1">
                    <span className="text-xs font-semibold opacity-80">Subjects:</span>
                    {subjects.map((subject: any) => (
                      <Badge key={subject.id} variant="secondary" className="text-xs bg-white/20 hover:bg-white/30 border-white/30">
                        {subject.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-4">
                  {course.rating > 0 && course.review_count > 1000 && course.rating >= 4.5 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">{course.rating}</span>
                      </div>
                      <span className="text-xs opacity-80">({course.review_count.toLocaleString()} reviews)</span>
                    </div>
                  )}
                  
                  {course.student_count > 20000 && (
                    <div className="flex items-center gap-2 bg-white/20 rounded-full px-2 py-0.5">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-semibold">{course.student_count.toLocaleString()} students</span>
                    </div>
                  )}
                  
                  {course.duration_months && (
                    <div className="flex items-center gap-2 bg-white/20 rounded-full px-2 py-0.5">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-semibold">{course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    {course.price_inr > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">₹{course.price_inr.toLocaleString()}</span>
                        {course.original_price_inr && course.original_price_inr > course.price_inr && (
                          <>
                            <span className="text-lg line-through opacity-60">
                              ₹{course.original_price_inr.toLocaleString()}
                            </span>
                            <Badge variant="secondary" className="bg-green-500 text-white text-xs">
                              {Math.round((1 - course.price_inr / course.original_price_inr) * 100)}% OFF
                            </Badge>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-3xl font-bold text-green-400">Free</span>
                    )}
                  </div>
                  
                  {isEnrolled ? (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="px-6 shadow-xl hover:shadow-2xl bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => navigate(`/learning/${course.id}`)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Continue Learning
                    </Button>
                  ) : course?.is_coming_soon ? (
                    <Badge className="bg-amber-500 text-white py-2 px-6 text-lg font-semibold">Coming Soon</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" className="px-6 shadow-xl hover:shadow-2xl" asChild>
                      <Link to={`/enroll/${course.slug}`}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Enroll Now
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Right Side - Video (facade) or Image */}
              {videoId ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 aspect-video">
                  <YouTubeFacade videoId={videoId} title={`${course.name} promotional video`} className="absolute inset-0 w-full h-full" />
                </div>
              ) : bannerThumbnail ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 aspect-video bg-gradient-to-br from-primary/20 to-accent/20">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/50 to-transparent z-10" />
                  <img
                    src={bannerThumbnail}
                    alt={course.name}
                    width={640}
                    height={360}
                    className="w-full h-full object-contain"
                    {...({ fetchpriority: 'high' } as any)}
                  />
                  <div className="absolute -bottom-4 -right-4 bg-white text-foreground rounded-xl p-4 shadow-xl z-20">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {!isEnrolled && freeChapterCount > 0 && (
          <FreePreviewCard courseSlug={course.slug} chapterCount={freeChapterCount} />
        )}

        <div className="container mx-auto px-4 py-6 md:py-12">
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6 md:space-y-8">
              {/* Subjects Covered */}
              {subjects.length > 0 && (
                <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-2 md:pb-4">
                    <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                      <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                      Subjects You'll Master
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 md:mt-2">
                      Click on any subject to explore the complete curriculum
                    </p>
                  </CardHeader>
                  <CardContent className="pt-4 md:pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {subjects.map((subject: any) => (
                        <Link 
                          key={subject.id}
                          to={`/subject/${subject.slug}?course=${slug}`}
                          className="block group"
                        >
                          <Card className="h-full hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary cursor-pointer bg-gradient-to-br from-background to-muted/20">
                            <CardContent className="p-4 md:p-5">
                              <div className="flex items-start gap-3 md:gap-4">
                                {rewriteStorageUrl(subject.thumbnail_url) ? (
                                  <div className="relative">
                                    <img
                                      src={rewriteStorageUrl(subject.thumbnail_url)!}
                                      alt={subject.name}
                                      width={64}
                                      height={64}
                                      loading="lazy"
                                      className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center group-hover:from-primary/40 group-hover:to-primary/20 transition-colors">
                                    <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-base md:text-lg group-hover:text-primary transition-colors mb-1 line-clamp-1">
                                    {subject.name}
                                  </h4>
                                  {subject.description && (
                                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-2">
                                      {subject.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 text-xs text-primary font-medium">
                                    <span>Explore Curriculum</span>
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* About Program */}
              {course.detailed_description && (
                <Card className="border-2">
                  <CardHeader className="pb-2 md:pb-4">
                    <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                      <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                      About This Program
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm md:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {stripMarkdown(course.detailed_description)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Below-fold: What You'll Learn, Features, FAQs */}
              <Suspense fallback={null}>
                <CourseBelowFold
                  learningPoints={learningPoints}
                  courseIncludes={[]}
                  faqs={faqs}
                  isMobile={false}
                />

                {/* AI Content & Trust Sections */}
                <CourseAIContentSection
                  courseName={course.name}
                  category={course.category}
                  whatYouLearn={learningPoints}
                  price={course.price_inr}
                  originalPrice={course.original_price_inr}
                />
                <CourseTrustSection rating={course.rating} studentCount={course.student_count} />
              </Suspense>
            </div>

            {/* Sidebar - Sticky */}
            <div className="lg:sticky lg:top-24 h-fit space-y-6">
              <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-background shadow-xl">
                <CardContent className="pt-6 text-center space-y-4">
                  <div>
                    {course.price_inr > 0 ? (
                      <>
                        <div className="text-3xl font-bold mb-1">
                          ₹{course.price_inr.toLocaleString()}
                        </div>
                        {course.original_price_inr && course.original_price_inr > course.price_inr && (
                          <div className="text-sm text-muted-foreground">
                            <span className="line-through">₹{course.original_price_inr.toLocaleString()}</span>
                            <Badge variant="secondary" className="ml-2 bg-green-500 text-white">
                              Save ₹{(course.original_price_inr - course.price_inr).toLocaleString()}
                            </Badge>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-3xl font-bold text-green-600">Free</div>
                    )}
                  </div>
                  {isEnrolled ? (
                    <Button 
                      size="lg" 
                      className="w-full text-lg shadow-lg bg-green-500 hover:bg-green-600"
                      onClick={() => navigate(`/learning/${course.id}`)}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Continue Learning
                    </Button>
                  ) : course?.is_coming_soon ? (
                    <Badge className="bg-amber-500 text-white py-3 px-6 text-lg font-semibold w-full text-center">Coming Soon</Badge>
                  ) : (
                    <>
                      <Button size="lg" className="w-full text-lg shadow-lg" asChild>
                        <Link to={`/enroll/${course.slug}`}>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Enroll Now
                        </Link>
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        30-day money-back guarantee
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 bg-gradient-to-br from-primary/5 to-background">
                <CardHeader>
                  <CardTitle className="text-xl">Course Highlights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subjects.length > 0 && (
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground">Subjects</span>
                      <span className="font-semibold text-lg">{subjects.length}</span>
                    </div>
                  )}
                  {course.duration_months && (
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold text-lg">{course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-muted-foreground">Students</span>
                    <span className="font-semibold text-lg">1,00,000+</span>
                  </div>
                  {course.rating > 0 && (
                    <div className="flex items-center justify-between py-3">
                      <span className="text-muted-foreground">Rating</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold text-lg">{course.rating}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {courseIncludes.length > 0 && (
                <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
                  <Card className="border-2 shadow-lg">
                    <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent">
                      <CardTitle className="text-xl">This Course Includes</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        {courseIncludes.map((item: any, index: number) => {
                          const text = typeof item === 'string' ? item : item.text || item.title || '';
                          return (
                            <div key={index} className="flex items-start gap-3">
                              <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <p className="text-sm text-muted-foreground">{text}</p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </Suspense>
              )}
            </div>
          </div>
        </div>

        {/* Final CTA Section */}
        <section className="bg-gradient-to-r from-primary via-primary/95 to-primary/90 text-primary-foreground py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Learning Journey?
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join thousands of students who have achieved their goals with {course.name}
            </p>
            {isEnrolled ? (
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg px-8 shadow-xl bg-green-500 hover:bg-green-600 text-white"
                onClick={() => navigate(`/learning/${course.id}`)}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Continue Learning
              </Button>
            ) : (
              <Button size="lg" variant="secondary" className="text-lg px-8 shadow-xl" asChild>
                <Link to={`/enroll/${course.slug}`}>
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Get Started Today
                </Link>
              </Button>
            )}
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default ProgramDetail;
