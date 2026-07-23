import { Suspense, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO";
import { generateOrganizationSchema, generateWebsiteSchema, generateHomepageFAQSchema } from "@/lib/seo/structuredData";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHomeContent } from "@/components/mobile/MobileHomeContent";
import { BottomNav } from "@/components/mobile/BottomNav";
import { useHomepageData } from "@/hooks/useHomepageData";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Eager above-the-fold (ships in main route chunk → no Suspense waterfall before paint)
import { SmartHeader } from "@/components/SmartHeader";
import { Hero } from "@/components/Hero";
import { ExploreProgramsSection } from "@/components/ExploreProgramsSection";
import heroBoardExams from "@/assets/hero-board-exams.jpg";

// Below-the-fold — lazy-loaded with retry
const BestsellersSection = lazyWithRetry(() => import("@/components/BestsellersSection").then(m => ({ default: m.BestsellersSection })));
const TopCourses = lazyWithRetry(() => import("@/components/TopCourses").then(m => ({ default: m.TopCourses })));
const MostPopularSection = lazyWithRetry(() => import("@/components/MostPopularSection").then(m => ({ default: m.MostPopularSection })));
const Footer = lazyWithRetry(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const ExpertAITeachers = lazyWithRetry(() => import("@/components/ExpertAITeachers").then(m => ({ default: m.ExpertAITeachers })));
const SSLCPromoDialog = lazyWithRetry(() => import("@/components/SSLCPromoDialog").then(m => ({ default: m.SSLCPromoDialog })));
const PromotionalSection = lazyWithRetry(() => import("@/components/PromotionalSection").then(m => ({ default: m.PromotionalSection })));
const TestimonialsSection = lazyWithRetry(() => import("@/components/TestimonialsSection").then(m => ({ default: m.TestimonialsSection })));
const AISearchContentSection = lazyWithRetry(() => import("@/components/AISearchContentSection").then(m => ({ default: m.AISearchContentSection })));
const HomepageFAQSection = lazyWithRetry(() => import("@/components/HomepageFAQSection").then(m => ({ default: m.HomepageFAQSection })));
const TrustCredibilitySection = lazyWithRetry(() => import("@/components/TrustCredibilitySection").then(m => ({ default: m.TrustCredibilitySection })));

const SEO_TITLE = "Online Classes for NEET, JEE & Board Exams | SimpleLecture";
const SEO_DESCRIPTION = "India's AI-powered online learning platform. Live classes, recorded video lectures, mock tests & 24/7 AI doubt solver for NEET, JEE, CBSE Class 11-12, SSLC & PUC. Join 1,00,000+ students from ₹1000 + GST per course for 1-year access.";
const SEO_KEYWORDS = "online classes, online lectures, online coaching, online learning platform India, NEET online coaching, JEE Main online classes, JEE Advanced preparation, CBSE Class 12 online classes, CBSE Class 11 online classes, physics online classes, chemistry online lectures, maths online tuition, biology online classes, science test series, mock test series, AI tutor for students, live classes, recorded lectures, video lectures, board exam preparation, JEE Main 2026, NEET 2026, SSLC, PUC, doubt solving app";

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: homepageData, isLoading, isError, error, refetch } = useHomepageData();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // One-shot intent flag: if the user clicked the logo to come home, skip the dashboard redirect.
      if (typeof window !== 'undefined' && sessionStorage.getItem('slStayHome') === '1') {
        sessionStorage.removeItem('slStayHome');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data: isAdmin } = await supabase
        .from('user_roles').select('role')
        .eq('user_id', session.user.id).eq('role', 'admin').maybeSingle();
      if (cancelled || isAdmin) return;
      const { data: enr } = await supabase
        .from('enrollments').select('id')
        .eq('student_id', session.user.id).eq('is_active', true).limit(1).maybeSingle();
      if (!cancelled && enr) navigate('/dashboard', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const structuredData = useMemo(() => ({
    "@context": "https://schema.org",
    "@graph": [
      generateOrganizationSchema(),
      generateWebsiteSchema(),
      generateHomepageFAQSchema()
    ]
  }), []);

  // Mobile-native layout
  if (isMobile) {
    return (
      <>
        <SEOHead
          title={SEO_TITLE}
          description={SEO_DESCRIPTION}
          keywords={SEO_KEYWORDS}
          canonicalUrl="https://simplelecture.com"
          structuredData={structuredData}
        />
        <MobileHomeContent />
        <BottomNav />
        <Suspense fallback={null}><SSLCPromoDialog /></Suspense>
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <SEOHead
        title={SEO_TITLE}
        description={SEO_DESCRIPTION}
        keywords={SEO_KEYWORDS}
        canonicalUrl="https://simplelecture.com"
        structuredData={structuredData}
        preloadImage={heroBoardExams}
      />
      <div className="min-h-screen bg-background">
        <SmartHeader />
        <main>
          <Hero heroVideoSettings={homepageData?.heroVideoSettings} />
          {isLoading && !homepageData && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mr-3" />
              <span className="text-muted-foreground">Loading courses...</span>
            </div>
          )}
          {isError && !homepageData && (
            <div className="container mx-auto px-4 py-12 text-center">
              <p className="text-destructive mb-4">
                {error instanceof Error ? error.message : "Something went wrong. Please try again."}
              </p>
              <button onClick={() => refetch()} className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm">
                Try Again
              </button>
            </div>
          )}
          {homepageData && (
            <>
              <ExploreProgramsSection
                categoriesData={homepageData?.categories}
                coursesData={homepageData?.courses}
              />
              <Suspense fallback={<div className="h-96" />}>
                <MostPopularSection
                  featuredCoursesData={homepageData?.mostPopular}
                />
                <BestsellersSection
                  featuredCoursesData={homepageData?.bestsellers}
                />
                <TopCourses
                  featuredCoursesData={homepageData?.topCourses}
                />
              </Suspense>
              <Suspense fallback={<div className="h-64" />}>
                <AISearchContentSection />
              </Suspense>
              <Suspense fallback={<div className="h-64" />}>
                <ExpertAITeachers />
              </Suspense>
            </>
          )}
          <Suspense fallback={<div className="h-64" />}>
            <PromotionalSection />
          </Suspense>
          <Suspense fallback={<div className="h-32" />}>
            <TrustCredibilitySection />
          </Suspense>
          <Suspense fallback={<div className="h-64" />}>
            <TestimonialsSection />
          </Suspense>
          <Suspense fallback={<div className="h-96" />}>
            <HomepageFAQSection />
          </Suspense>
        </main>
        <Suspense fallback={<div className="h-48" />}>
          <Footer />
        </Suspense>
        <Suspense fallback={null}><SSLCPromoDialog /></Suspense>
      </div>
    </>
  );
};

export default Index;
