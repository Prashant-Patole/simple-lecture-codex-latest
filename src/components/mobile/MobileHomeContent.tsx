import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { MobileHomeSearch } from "./MobileHomeSearch";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/contexts/AuthContext";
import { useHomepageData } from "@/hooks/useHomepageData";
import { useDailyAttendance } from "@/hooks/useDailyAttendance";
import { HeroLecturePlayer } from "@/components/HeroLecturePlayer";
import { HeroV4Launcher } from "@/components/HeroV4Launcher";
import { HOMEPAGE_HERO_LECTURE } from "@/lib/homepageHeroLecture";
import headerIcon from "@/assets/header-icon.jpeg";

// Only import first hero image statically - others loaded after first paint
import heroBoardExams from "@/assets/hero-board-exams.jpg";

// Lazy-load heavy components
const HamburgerMenu = lazy(() => import("./HamburgerMenu").then(m => ({ default: m.HamburgerMenu })));
const MobileCourseSections = lazy(() => import("./MobileCourseSections"));
const ExpertAITeachers = lazy(() => import("@/components/ExpertAITeachers").then(m => ({ default: m.ExpertAITeachers })));
const AISearchContentSection = lazy(() => import("@/components/AISearchContentSection").then(m => ({ default: m.AISearchContentSection })));
const TrustCredibilitySection = lazy(() => import("@/components/TrustCredibilitySection").then(m => ({ default: m.TrustCredibilitySection })));
const HomepageFAQSection = lazy(() => import("@/components/HomepageFAQSection").then(m => ({ default: m.HomepageFAQSection })));

// Hero slide data
const heroSlideData = [
  {
    title: "SSLC Board Exam Prep",
    subtitle: "Score 90+ in Your 10th Board Exams",
    points: ["All subjects covered", "AI doubt clearing 24/7", "Unlimited practice tests"],
    cta: "Start Learning - ₹1000 + GST",
  },
  {
    title: "10th Board Made Easy",
    subtitle: "Complete SSLC Course with AI Tutoring",
    points: ["Chapter-wise video lessons", "Previous year papers solved", "Personalized weak area focus"],
    cta: "Join Now - ₹1000 + GST",
  },
  {
    title: "Ace Your SSLC Exams",
    subtitle: "Maths, Science, Social Studies & More",
    points: ["Kannada & English medium", "Mock tests & quizzes", "Track your progress daily"],
    cta: "Get Started Today",
  },
];

const ErrorFallback = ({ onRetry }: { onRetry: () => void }) => (
  <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
    <div className="text-center px-4">
      <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Unable to load courses</h3>
      <p className="text-muted-foreground text-sm mb-4">
        We're having trouble connecting. Please try again.
      </p>
      <Button onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  </div>
);

export const MobileHomeContent = () => {
  const navigate = useNavigate();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroImages = [heroBoardExams, heroBoardExams, heroBoardExams];
  
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { isAuthenticated } = useAuth();
  
  // Use consolidated homepage data hook
  const { data: homepageData, isError: hasError, refetch } = useHomepageData();
  const newestCourses = homepageData?.courses?.map(c => ({
    id: c.id,
    course_id: c.id,
    display_order: null,
    courses: c,
  }));
  const mostPopularCourses = homepageData?.mostPopular;
  
  // Record daily attendance (deferred in hook)
  useDailyAttendance('mobile');

  const userName = user?.profile?.full_name || "Learner";

  // Auto-rotate hero slides
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        setCurrentSlide((prev) => (prev + 1) % heroSlideData.length);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []);


  const heroSlides = heroSlideData.map((slide, index) => ({
    ...slide,
    image: heroImages[index],
  }));

  // Error state
  if (hasError) {
    return <ErrorFallback onRetry={() => refetch()} />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Native App Header */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary px-4 pt-10 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="text-white [&_button]:text-white [&_button]:hover:bg-white/10 mt-1">
              <Suspense fallback={<div className="w-6 h-6" />}>
                <HamburgerMenu />
              </Suspense>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white text-lg font-bold">
                  {`Hi ${userLoading ? 'Learner' : userName.split(' ')[0]}`}
                </h1>
                <span className="text-xl">👋</span>
              </div>
              {!userLoading && (
                <p className="text-white/80 text-sm">Let's start learning!</p>
              )}
            </div>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 shadow-md flex-shrink-0">
            <img
              src={headerIcon} 
              alt="Header Icon" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>

        <MobileHomeSearch />
      </div>

      {/* Hero Section - Fixed dimensions for CLS */}
      <div className="relative overflow-hidden" style={{ height: '256px' }}>
        {heroSlides.map((slide, index) => {
          const isActive = currentSlide === index;
          const isFirst = index === 0;
          return (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Always render first slide image for LCP; conditionally render others */}
            {(isFirst || isActive) && (
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
                width={414}
                height={256}
                {...(isFirst ? ({ fetchpriority: 'high' } as any) : { loading: 'lazy' as const })}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h2 className="text-xl font-bold leading-tight mb-1">{slide.title}</h2>
              <p className="text-white/80 text-xs mb-2">{slide.subtitle}</p>
              
              <div className="space-y-1 mb-3">
                {slide.points.map((point, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span className="text-[11px] text-white/90">{point}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  size="sm"
                  className="bg-white text-primary hover:bg-white/90 text-xs h-8 px-4"
                  onClick={() => navigate("/course/Class-10")}
                >
                  {slide.cta}
                  <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white/10 text-white border border-white/40 hover:bg-white/20 hover:text-white text-xs h-8 px-3"
                  onClick={() => navigate("/course/Class-10/preview")}
                >
                  Free Preview
                </Button>
              </div>
            </div>
          </div>
          );
        })}
        
        <div className="absolute bottom-2 right-4 flex gap-1">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1 rounded-full transition-all ${
                currentSlide === index ? "bg-white w-4" : "bg-white/40 w-2"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Hero AI Lecture Player (portrait) - full bleed on mobile */}
      <div className="mt-4">
        {HOMEPAGE_HERO_LECTURE.player === "v4" ? (
          <HeroV4Launcher
            jobId={HOMEPAGE_HERO_LECTURE.jobId}
            vimeoId={HOMEPAGE_HERO_LECTURE.vimeoId}
            videoMp4Url={HOMEPAGE_HERO_LECTURE.videoMp4Url}
            title={HOMEPAGE_HERO_LECTURE.title}
            subtitle={HOMEPAGE_HERO_LECTURE.subtitle}
            mobileExtraHeight={30}
          />
        ) : (
          <HeroLecturePlayer
            jobId={HOMEPAGE_HERO_LECTURE.jobId}
            title={HOMEPAGE_HERO_LECTURE.title}
            subtitle={HOMEPAGE_HERO_LECTURE.subtitle}
            mobileFullBleed
            mobileExtraHeight={30}
          />
        )}
      </div>

      {/* Course Sections - Lazy loaded */}
      <Suspense fallback={<div className="min-h-[420px] animate-pulse bg-muted/40 rounded-xl mx-4 mt-4" />}>
        <div style={{ minHeight: 420 }}>
          <MobileCourseSections 
            mostPopularCourses={mostPopularCourses as any} 
            newestCourses={newestCourses as any} 
          />
        </div>
      </Suspense>

      {/* Expert AI Teachers Section - Lazy loaded */}
      <Suspense fallback={<div className="min-h-[280px]" />}>
        <ExpertAITeachers />
      </Suspense>

      {/* SEO Content Sections - Lazy loaded */}
      <Suspense fallback={<div className="min-h-[200px]" />}>
        <AISearchContentSection />
      </Suspense>
      <Suspense fallback={<div className="min-h-[100px]" />}>
        <TrustCredibilitySection />
      </Suspense>
      <Suspense fallback={<div className="min-h-[300px]" />}>
        <HomepageFAQSection />
      </Suspense>
    </div>
  );
};
