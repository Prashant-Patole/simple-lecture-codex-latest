// Programmatic SEO landing page configuration
// Each entry maps a URL path to high-intent keyword-rich content

export interface LandingFAQ {
  q: string;
  a: string;
}

export interface LandingPageConfig {
  slug: string; // path under /learn, e.g. "jee-main-online-coaching"
  h1: string;
  title: string; // <60 chars for <title>
  description: string; // <160 chars for meta
  keywords: string;
  heroSubtitle: string;
  intro: string; // 1-2 paragraphs of keyword-rich copy
  features: { title: string; body: string }[];
  whyUs: string[];
  faqs: LandingFAQ[];
  ctaCourseSlug?: string; // optional course to point CTA to
  ctaText?: string;
  relatedLinks?: { label: string; href: string }[];
}

export const LANDING_PAGES: LandingPageConfig[] = [
  {
    slug: "jee-main-online-coaching",
    h1: "JEE Main 2026 Online Coaching & Live Classes",
    title: "JEE Main 2026 Online Coaching | Live Classes & Mock Tests",
    description:
      "Crack JEE Main 2026 with India's best online coaching. Live classes, recorded video lectures, AI doubt solver, DPP, mock tests & PYQs. Free demo available.",
    keywords:
      "JEE Main 2026 online coaching, JEE Main preparation, JEE online classes, JEE Main mock test, JEE Main live classes, JEE coaching India, JEE Main video lectures, best online coaching for JEE Main, JEE AI doubt solver",
    heroSubtitle:
      "Live classes by IITian faculty, full-length mock tests, daily practice problems and an AI tutor available 24×7.",
    intro:
      "SimpleLecture offers the most comprehensive JEE Main 2026 online coaching program in India. Learn from experienced IITian faculty through live interactive classes, watch recorded video lectures any time, solve daily practice problems (DPPs), attempt full-length mock tests modeled on the latest NTA pattern, and clear every doubt instantly with our AI tutor. Whether you are starting from Class 11 or revising in Class 12, our structured JEE Main preparation roadmap helps you cover Physics, Chemistry and Mathematics with complete syllabus mastery.",
    features: [
      { title: "Live Online Classes", body: "Interactive JEE Main live classes by top IITian teachers with real-time doubt solving." },
      { title: "Recorded Video Lectures", body: "Watch JEE Main video lectures anytime, anywhere with offline download support." },
      { title: "AI Doubt Solver", body: "Get instant step-by-step solutions to any Physics, Chemistry or Maths doubt with our AI tutor." },
      { title: "Mock Tests & PYQs", body: "Full-length JEE Main mock tests and last 20 years previous year question papers with detailed solutions." },
      { title: "Daily Practice Problems", body: "Topic-wise DPPs to build problem-solving speed and accuracy." },
      { title: "Performance Analytics", body: "Detailed analytics to track weak areas and improve your JEE Main rank." },
    ],
    whyUs: [
      "IITian and PhD faculty with 10+ years of JEE coaching experience",
      "Complete JEE Main 2026 syllabus coverage with NCERT-based foundation",
      "Affordable compared to BYJU'S, Unacademy, Allen and PhysicsWallah",
      "Free demo class — no credit card required",
      "Hindi and English medium options",
    ],
    faqs: [
      {
        q: "Is SimpleLecture good for JEE Main 2026 preparation?",
        a: "Yes. SimpleLecture provides complete JEE Main 2026 online coaching with live classes, recorded lectures, mock tests, PYQs and an AI doubt solver — everything you need to crack JEE Main from home.",
      },
      {
        q: "How much does JEE Main online coaching cost on SimpleLecture?",
        a: "Our JEE Main 2026 online coaching is significantly more affordable than offline coaching. Pricing varies by package — visit the course page for current fees and EMI options.",
      },
      {
        q: "Can I crack JEE Main with online classes only?",
        a: "Absolutely. Thousands of students crack JEE Main every year through online coaching. With SimpleLecture's structured curriculum, mock tests and AI doubt support, online preparation is just as effective as offline.",
      },
      {
        q: "Do you provide JEE Main previous year question papers?",
        a: "Yes. You get last 20 years of JEE Main PYQs with video solutions, plus chapter-wise PYQ practice and full-length tests.",
      },
    ],
    ctaCourseSlug: "jee-main-2026-complete",
    ctaText: "Start JEE Main 2026 Preparation",
    relatedLinks: [
      { label: "NEET 2026 Online Coaching", href: "/learn/neet-2026-online-coaching" },
      { label: "Class 11 Physics Online Classes", href: "/learn/class-11-physics-online-classes" },
      { label: "Physics Online Classes", href: "/learn/physics-online-classes" },
    ],
  },
  {
    slug: "neet-2026-online-coaching",
    h1: "NEET 2026 Online Coaching & Biology Live Classes",
    title: "NEET 2026 Online Coaching | Biology, Physics & Chemistry",
    description:
      "Prepare for NEET 2026 with live online classes, NCERT-based biology lectures, mock tests, PYQs and AI doubt support. Join India's trusted NEET coaching platform.",
    keywords:
      "NEET 2026 online coaching, NEET preparation, NEET online classes, NEET biology classes, NEET mock test, NEET live classes, best online coaching for NEET, NEET AI doubt solver, NCERT biology online",
    heroSubtitle:
      "NCERT-focused biology, problem-solving physics, and concept-based chemistry — all in one NEET 2026 program.",
    intro:
      "SimpleLecture's NEET 2026 online coaching is designed for medical aspirants who want to crack NEET-UG with NCERT mastery. Get structured Biology, Physics and Chemistry coverage through live interactive classes, recorded video lectures, NEET-pattern mock tests, chapter-wise PYQs and an AI tutor for instant doubt clearing. Suitable for both droppers and Class 11/12 students.",
    features: [
      { title: "NCERT-First Biology", body: "Line-by-line NCERT biology coverage by top medical faculty — the backbone of NEET preparation." },
      { title: "Live NEET Classes", body: "Daily live classes for Physics, Chemistry and Biology with doubt sessions." },
      { title: "AI Doubt Solver", body: "Stuck on a biology diagram or a physics numerical? Get instant AI explanations 24×7." },
      { title: "NEET Mock Tests", body: "Full-length and chapter-wise mock tests on the latest NEET pattern with NTA-style analysis." },
      { title: "PYQ Bank", body: "Last 30 years of NEET previous year questions with video solutions." },
      { title: "Offline Lecture Downloads", body: "Download NEET video lectures for offline study on mobile." },
    ],
    whyUs: [
      "AIIMS and top medical college faculty",
      "Complete NEET 2026 syllabus aligned with latest NTA pattern",
      "Affordable NEET coaching with free demo",
      "Hindi + English medium",
      "Trusted by NEET droppers and repeaters",
    ],
    faqs: [
      {
        q: "Which is the best online platform for NEET 2026 preparation?",
        a: "SimpleLecture is one of the best online platforms for NEET 2026 — offering NCERT-based biology, live classes, AI doubt support and full-length mock tests at affordable pricing.",
      },
      {
        q: "Can I crack NEET in the first attempt with online coaching?",
        a: "Yes. With SimpleLecture's structured NEET program, NCERT mastery and regular mock tests, many first-attempt aspirants clear NEET successfully.",
      },
      {
        q: "Do you cover NCERT biology in detail?",
        a: "Yes. Our NEET biology classes follow NCERT line-by-line, with diagrams, MCQs and assertion-reason practice for every chapter.",
      },
    ],
    ctaCourseSlug: "neet-2026-foundation",
    ctaText: "Start NEET 2026 Preparation",
    relatedLinks: [
      { label: "JEE Main 2026 Online Coaching", href: "/learn/jee-main-2026-online-coaching" },
      { label: "Class 12 Biology Online Classes", href: "/learn/class-12-biology-online-classes" },
    ],
  },
  {
    slug: "class-12-physics-online-classes",
    h1: "Class 12 Physics Online Classes (CBSE Board + JEE/NEET)",
    title: "Class 12 Physics Online Classes | CBSE Board, JEE & NEET",
    description:
      "Master Class 12 Physics with online live classes, NCERT chapter-wise video lectures, sample papers and previous year board questions. Free demo class available.",
    keywords:
      "Class 12 Physics online classes, CBSE Class 12 Physics, Class 12 Physics video lectures, NCERT Physics Class 12, Class 12 board exam preparation, Class 12 Physics online coaching, Class 12 Physics sample papers",
    heroSubtitle:
      "Chapter-wise NCERT physics for boards plus advanced problem solving for JEE/NEET — taught by experienced physics faculty.",
    intro:
      "Score 95+ in Class 12 Physics boards and build a rock-solid foundation for JEE Main, JEE Advanced and NEET. SimpleLecture's Class 12 Physics online classes cover the complete CBSE NCERT syllabus — Electrostatics, Current Electricity, Magnetism, EMI, Optics, Modern Physics and more — through live sessions, recorded video lectures, derivations, numerical practice, and full sample paper solutions.",
    features: [
      { title: "Full NCERT Syllabus", body: "Every chapter of CBSE Class 12 Physics with line-by-line NCERT coverage." },
      { title: "Board + Competitive", body: "One course for board exams, JEE Main and NEET — no separate batches needed." },
      { title: "Derivations Made Simple", body: "Step-by-step physics derivations explained visually." },
      { title: "Sample Papers & PYQs", body: "Last 10 years CBSE board PYQs with video solutions." },
      { title: "AI Physics Tutor", body: "Solve any physics numerical instantly with the AI doubt solver." },
    ],
    whyUs: [
      "IITian and MSc physics faculty",
      "Aligned with CBSE 2025-26 syllabus",
      "Includes JEE/NEET-level questions",
      "Free demo lecture",
    ],
    faqs: [
      {
        q: "Is Class 12 Physics easy to learn online?",
        a: "Yes. With chapter-wise video lectures, live doubt classes, derivations and a 24×7 AI tutor, learning Class 12 Physics online is highly effective.",
      },
      {
        q: "Does this cover both board exam and JEE/NEET physics?",
        a: "Yes. The course covers complete CBSE NCERT for boards and includes additional problem solving for JEE Main and NEET.",
      },
    ],
    ctaCourseSlug: "class-12-physics-mastery",
    ctaText: "Start Class 12 Physics",
    relatedLinks: [
      { label: "Class 11 Physics Online Classes", href: "/learn/class-11-physics-online-classes" },
      { label: "Physics Online Classes", href: "/learn/physics-online-classes" },
      { label: "JEE Main 2026 Online Coaching", href: "/learn/jee-main-2026-online-coaching" },
    ],
  },
  {
    slug: "class-11-physics-online-classes",
    h1: "Class 11 Physics Online Classes (CBSE + JEE/NEET Foundation)",
    title: "Class 11 Physics Online Classes | CBSE + JEE/NEET Foundation",
    description:
      "Learn Class 11 Physics online — Mechanics, Thermodynamics, Waves & more. NCERT video lectures, live doubt classes, JEE/NEET foundation. Free demo.",
    keywords:
      "Class 11 Physics online classes, CBSE Class 11 Physics, Class 11 Physics video lectures, NCERT Physics Class 11, JEE foundation Class 11, NEET foundation Class 11, Class 11 Physics online coaching",
    heroSubtitle:
      "Build a rock-solid foundation in Mechanics, Thermodynamics and Waves with live classes and recorded lectures.",
    intro:
      "Class 11 is the most important year for JEE and NEET aspirants. SimpleLecture's Class 11 Physics online classes give you complete NCERT coverage, live interactive sessions, advanced JEE/NEET-level problem solving and a 24×7 AI tutor — so you can build the strongest possible foundation for Class 12 and beyond.",
    features: [
      { title: "NCERT + Beyond", body: "Complete CBSE NCERT Class 11 Physics with JEE/NEET extension topics." },
      { title: "Mechanics Mastery", body: "Kinematics, Laws of Motion, Work-Energy-Power and Rotational Motion in depth." },
      { title: "Live Doubt Classes", body: "Weekly live sessions to clear every doubt in real time." },
      { title: "AI Physics Tutor", body: "Instant step-by-step solutions for any physics problem." },
    ],
    whyUs: [
      "IITian faculty with JEE/NEET teaching experience",
      "Foundation + competitive prep in one course",
      "Affordable and free demo available",
    ],
    faqs: [
      {
        q: "Should I start JEE preparation in Class 11?",
        a: "Yes. Class 11 is the ideal time to start JEE/NEET preparation. SimpleLecture's Class 11 Physics builds both board exam strength and competitive aptitude.",
      },
    ],
    ctaText: "Browse Class 11 Courses",
    relatedLinks: [
      { label: "Class 12 Physics Online Classes", href: "/learn/class-12-physics-online-classes" },
      { label: "JEE Main 2026 Online Coaching", href: "/learn/jee-main-2026-online-coaching" },
    ],
  },
  {
    slug: "physics-online-classes",
    h1: "Physics Online Classes for Class 9, 10, 11, 12 & JEE/NEET",
    title: "Physics Online Classes | Class 9-12, JEE & NEET",
    description:
      "Best physics online classes in India — live lectures, recorded videos, NCERT solutions, AI doubt solver for Class 9, 10, 11, 12, JEE & NEET aspirants.",
    keywords:
      "physics online classes, physics video lectures, JEE physics, NEET physics, CBSE physics online, NCERT physics, physics tuition online, online physics coaching India",
    heroSubtitle:
      "From Class 9 fundamentals to JEE Advanced — one platform for every physics learner.",
    intro:
      "SimpleLecture offers India's most comprehensive physics online classes for school students and competitive exam aspirants. Whether you are in Class 9, Class 10, Class 11, Class 12 or preparing for JEE Main, JEE Advanced or NEET, our physics courses combine NCERT clarity with advanced problem solving — taught by IITian faculty through live classes and HD recorded video lectures.",
    features: [
      { title: "Class 9 to JEE/NEET", body: "Complete physics journey from school basics to competitive mastery." },
      { title: "Concept + Numerical", body: "Strong theory plus 1000s of solved physics numericals." },
      { title: "AI Physics Tutor", body: "Stuck on a numerical? Get step-by-step AI explanations 24×7." },
    ],
    whyUs: [
      "IITian physics faculty",
      "Most affordable physics coaching in India",
      "Free demo class",
    ],
    faqs: [
      {
        q: "What is the best app for physics online classes?",
        a: "SimpleLecture is a top-rated platform for physics online classes covering Class 9-12, JEE and NEET with live + recorded lectures and AI doubt support.",
      },
    ],
    ctaText: "Browse Physics Courses",
    relatedLinks: [
      { label: "Class 12 Physics Online Classes", href: "/learn/class-12-physics-online-classes" },
      { label: "Class 11 Physics Online Classes", href: "/learn/class-11-physics-online-classes" },
      { label: "JEE Main 2026 Online Coaching", href: "/learn/jee-main-2026-online-coaching" },
    ],
  },
  {
    slug: "online-coaching-india",
    h1: "Best Online Coaching Platform in India for School & Competitive Exams",
    title: "Best Online Coaching in India | JEE, NEET, CBSE Live Classes",
    description:
      "India's most trusted online coaching platform. Live classes, recorded lectures, AI doubt solver & mock tests for JEE, NEET, CBSE Class 9-12. Free demo.",
    keywords:
      "best online coaching India, online coaching platform, online classes India, online tuition India, e-learning platform India, online education India, affordable online coaching",
    heroSubtitle:
      "Live classes, recorded lectures, AI tutor and mock tests — trusted by students across India.",
    intro:
      "SimpleLecture is one of India's best online coaching platforms — offering live interactive classes, HD recorded video lectures, full mock tests and a 24×7 AI tutor for CBSE, ICSE, JEE Main, JEE Advanced, NEET and foundation students. Designed for Indian learners, supported in Hindi and English, and priced to be accessible for every household.",
    features: [
      { title: "Live + Recorded", body: "Attend live classes or watch recorded video lectures any time." },
      { title: "AI Doubt Solver", body: "24×7 AI tutor for instant doubt clearing across subjects." },
      { title: "Mock Tests & DPPs", body: "Full-length mock tests and daily practice problems with analytics." },
      { title: "Affordable", body: "Significantly cheaper than offline coaching with EMI options." },
    ],
    whyUs: [
      "Top IITian and PhD faculty",
      "Hindi + English medium",
      "Free demo class",
      "Trusted by parents and students across India",
    ],
    faqs: [
      {
        q: "Which is the best online coaching platform in India?",
        a: "SimpleLecture is among the best online coaching platforms in India — combining affordability, IITian faculty, live classes, AI doubt support and a complete course library for JEE, NEET and CBSE.",
      },
    ],
    ctaText: "Explore All Courses",
    relatedLinks: [
      { label: "JEE Main 2026 Online Coaching", href: "/learn/jee-main-2026-online-coaching" },
      { label: "NEET 2026 Online Coaching", href: "/learn/neet-2026-online-coaching" },
      { label: "Physics Online Classes", href: "/learn/physics-online-classes" },
    ],
  },
];

export const LANDING_PAGE_MAP: Record<string, LandingPageConfig> =
  LANDING_PAGES.reduce((acc, p) => {
    acc[p.slug] = p;
    return acc;
  }, {} as Record<string, LandingPageConfig>);
