import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { HeroVideoSettings } from "@/hooks/useHomepageData";
import { HeroLecturePlayer } from "@/components/HeroLecturePlayer";
import { HeroV4Launcher } from "@/components/HeroV4Launcher";
import { HOMEPAGE_HERO_LECTURE } from "@/lib/homepageHeroLecture";

// Only import first hero image statically - others loaded after first paint
import heroBoardExams from "@/assets/hero-board-exams.jpg";

// Hero slide data - images loaded dynamically except first
const heroSlideData = [
  {
    title: "Score 90+ in Your SSLC Board Exams",
    subtitle: "Complete 10th Board Preparation with AI Tutoring",
    points: [
      "All subjects covered – Maths, Science, Social Studies & more",
      "24/7 AI doubt clearing in Kannada, Hindi & English",
      "Unlimited practice questions & mock tests",
    ],
    cta: "Start Learning at Just ₹1000 + GST",
  },
  {
    title: "10th Board Made Easy with AI",
    subtitle: "Master Every Subject, Ace Every Exam",
    points: [
      "Chapter-wise video lessons & notes",
      "AI-generated practice papers matching board pattern",
      "Personalized weak area improvement",
    ],
    cta: "Join 1,00,000+ SSLC Students at ₹1000 + GST",
  },
  {
    title: "Ace Your SSLC Exams",
    subtitle: "Maths, Science, Social Studies & More",
    points: [
      "Step-by-step solutions for every problem",
      "AI tutor explains concepts until you master them",
      "Previous years' papers & video solutions",
    ],
    cta: "Begin Your Board Prep – ₹1000 + GST",
  },
];

interface HeroProps {
  heroVideoSettings?: HeroVideoSettings;
}

export const Hero = (_props: HeroProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroImages = [heroBoardExams, heroBoardExams, heroBoardExams];
  const navigate = useNavigate();

  // Auto-rotate slides - pause when tab is hidden (memory leak fix)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        setCurrentSlide((prev) => (prev + 1) % heroSlideData.length);
      }
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const heroSlides = heroSlideData.map((slide, index) => ({
    ...slide,
    image: heroImages[index],
  }));

  const handleCtaClick = () => {
    navigate("/course/Class-10");
  };

  return (
    <section className="relative min-h-[80vh] md:min-h-[90vh] lg:min-h-screen flex items-center overflow-clip pb-8">
      {/* Background Images with Enhanced Overlays */}
      {heroSlides.map((slide, index) => {
        const isActive = currentSlide === index;
        return (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Only render active slide image to reduce DOM/paint cost */}
            {isActive && (
              <img
                src={slide.image}
                alt={slide.title}
                width={1920}
                height={1080}
                className="w-full h-full object-cover scale-105"
                {...({ fetchpriority: index === 0 ? 'high' : 'low' } as any)}
                loading={index === 0 ? "eager" : "lazy"}
              />
            )}
            {/* Multi-layer gradient for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />
          </div>
        );
      })}

      {/* Floating Glass Orbs - static opacity to avoid GPU paint thrashing */}
      <div className="absolute top-20 right-[15%] w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-60" />
      <div className="absolute bottom-32 left-[10%] w-56 h-56 bg-primary/15 rounded-full blur-3xl opacity-50" />
      <div className="absolute top-1/2 right-[5%] w-40 h-40 bg-pink-400/10 rounded-full blur-2xl opacity-40" />

      {/* Subtle Dot Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 lg:py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_515px] gap-8 lg:gap-10 items-center">
          {/* Left - Text Content */}
          <div className="w-full text-center lg:text-left">
            {heroSlides.map((slide, index) => (
              <div
                key={index}
                className={`transition-all duration-700 ${
                  currentSlide === index
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 absolute -translate-x-8 pointer-events-none"
                }`}
              >
                <div className="space-y-4 animate-fade-in">
                  {/* Animated Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-lg shadow-purple-500/10">
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span className="text-sm text-white/90 font-medium tracking-wide">AI-Powered Learning</span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  </div>

                  {/* Title */}
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
                    {slide.title}
                  </h1>
                  
                  {/* Gradient Subtitle */}
                  <p className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 bg-clip-text text-transparent">
                    {slide.subtitle}
                  </p>
                  
                  {/* Feature Points with Glass Icons */}
                  <div className="space-y-3 pt-2 text-left">
                    {slide.points.map((point, i) => (
                      <div key={i} className="flex items-start gap-4 group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg shadow-emerald-500/10 flex-shrink-0 mt-0.5 group-hover:bg-white/20 transition-colors">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        </div>
                        <p className="text-base md:text-lg text-white/90 leading-relaxed">{point}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <Button 
                      size="lg" 
                      className="relative overflow-hidden bg-white/95 backdrop-blur-sm text-primary hover:bg-white shadow-2xl shadow-purple-500/30 border border-white/50 text-base md:text-lg px-6 py-5 h-auto rounded-xl group transition-all duration-300 hover:shadow-purple-500/40 hover:scale-[1.02] whitespace-normal text-left"
                      onClick={handleCtaClick}
                    >
                      <span className="relative z-10 flex items-center gap-2 font-semibold">
                        {slide.cta}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" />
                      </span>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/30 bg-white/5 text-white hover:bg-white/10 text-base px-6 py-6 h-auto rounded-xl"
                      onClick={() => navigate("/course/Class-10/preview")}
                    >
                      Explore Free Lessons
                    </Button>
                  </div>

                  {/* Model Question Paper Highlight */}
                  <div className="pt-3">
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md rounded-xl border border-amber-400/30 shadow-lg shadow-amber-500/10 animate-pulse">
                      <span className="text-lg">📝</span>
                      <span className="text-sm md:text-base font-semibold text-amber-100">Model Question Papers — up to 80% question match!</span>
                    </div>
                  </div>

                  {/* Trust Indicators */}
                  <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-white/70 text-sm">
                    <span className="flex items-center gap-1">⭐ 4.9/5 rating</span>
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span>1,00,000+ students</span>
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span>95% success rate</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Modern Slide Indicators */}
            <div className="flex gap-3 pt-8 justify-center lg:justify-start">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    currentSlide === index 
                      ? "bg-white w-12 shadow-lg shadow-white/40" 
                      : "bg-white/30 w-6 hover:bg-white/50"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Right - Compact AI Lecture Player (mobile-style on desktop) */}
          <div className="w-full lg:w-[515px] justify-self-center lg:justify-self-end">
            {HOMEPAGE_HERO_LECTURE.player === "v4" ? (
              <HeroV4Launcher
                jobId={HOMEPAGE_HERO_LECTURE.jobId}
                vimeoId={HOMEPAGE_HERO_LECTURE.vimeoId}
                videoMp4Url={HOMEPAGE_HERO_LECTURE.videoMp4Url}
                title={HOMEPAGE_HERO_LECTURE.title}
                subtitle={HOMEPAGE_HERO_LECTURE.subtitle}
                forceCompact
                mobileExtraHeight={30}
              />
            ) : (
              <HeroLecturePlayer
                jobId={HOMEPAGE_HERO_LECTURE.jobId}
                title={HOMEPAGE_HERO_LECTURE.title}
                subtitle={HOMEPAGE_HERO_LECTURE.subtitle}
                forceCompact
                mobileExtraHeight={30}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
