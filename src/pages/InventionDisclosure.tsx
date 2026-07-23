import { SEOHead } from "@/components/SEO/SEOHead";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FileText, Lightbulb, Cog, Search, Star, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const questions = [
  {
    icon: Lightbulb,
    question: "1. Title of the Invention",
    answer:
      "AI-Powered Multilingual Adaptive Learning Management System with AI Avatar-Based Lecture Generation and Real-Time Language Dubbing for Affordable Education Delivery.",
  },
  {
    icon: Cog,
    question: "2. Technology Field of the Invention",
    answer:
      "The invention falls within the domains of Artificial Intelligence (AI), Natural Language Processing (NLP), Computer Vision, Speech Synthesis (Text-to-Speech), Adaptive Learning Systems, and Cloud-Based Educational Technology (EdTech). It integrates AI avatar generation, multi-language audio dubbing, intelligent content delivery, and personalized learning analytics into a unified Learning Management System (LMS).",
  },
  {
    icon: Search,
    question: "3. Has a Patent / Literature Search Been Done? Relevant Patents / References / Links",
    answer:
      "Yes, a preliminary patent and literature search has been conducted. Existing patents in the EdTech space primarily cover generic adaptive learning algorithms (e.g., US Patent No. 10,304,352 — Adaptive learning system), AI-based tutoring systems (e.g., US Patent No. 9,818,307 — Intelligent tutoring system), and video-based learning platforms. However, no existing patent combines AI avatar-based lecture generation with real-time multilingual dubbing, adaptive learning paths, and an ultra-affordable pricing model (₹1000/year) within a single integrated LMS platform. Key references include Coursera, Khan Academy, BYJU'S, and Unacademy — all of which lack the specific combination of features present in this invention.",
  },
  {
    icon: Star,
    question: "4. What Kind of Similar Technologies Exist? Problems in Existing Technologies?",
    answer:
      "Similar technologies include platforms like BYJU'S, Unacademy, Vedantu, Khan Academy, and Coursera. These platforms suffer from several limitations: (a) High subscription costs making them inaccessible to economically weaker sections; (b) Content available in limited languages, primarily English and Hindi, excluding regional language learners; (c) Reliance on human instructors for all content creation, making scaling expensive and slow; (d) Lack of truly personalized adaptive learning — most platforms offer the same content path to all students; (e) No AI avatar-based instruction that can dynamically generate lectures in multiple languages; (f) Absence of integrated AI tutoring that can answer doubts contextually from course material in real-time.",
  },
  {
    icon: Star,
    question: "5. What is the Advantage / Benefit Over Existing Technologies?",
    answer:
      "SimpleLecture offers several distinct advantages: (a) AI Avatar Lectures — Lessons are delivered by AI-generated avatars, eliminating dependency on human instructors for scalable content creation; (b) Real-Time Multilingual Dubbing — Content is automatically dubbed into 8+ Indian regional languages (Kannada, Tamil, Telugu, Hindi, Malayalam, etc.), making education truly inclusive; (c) Ultra-Affordable Pricing — Complete course access at ₹1000/year, making quality education accessible to all economic segments; (d) Adaptive Learning Engine — The system tracks student performance and dynamically adjusts difficulty, content recommendations, and revision schedules; (e) AI-Powered Doubt Resolution — An integrated AI tutor answers student questions contextually using RAG (Retrieval-Augmented Generation) from course material; (f) Comprehensive Assessment System — Daily Practice Problems (DPP), MCQ banks, assignments, and AI-generated assessments with instant feedback; (g) Live Class Integration — Seamless integration of live classes with recordings, attendance tracking, and instructor management.",
  },
  {
    icon: BookOpen,
    question: "6. Please Provide a Detailed Description of the Invention",
    answer:
      "SimpleLecture is an AI-first Learning Management System designed to democratize quality education across India. The platform combines multiple AI technologies into a cohesive educational ecosystem. At its core, the system uses AI avatar technology to generate video lectures from structured educational content — a human-quality teaching experience without requiring physical instructors for every lesson. These lectures are then processed through a proprietary multilingual dubbing pipeline that converts them into 8+ regional Indian languages using advanced Text-to-Speech models, preserving educational context and terminology accuracy. The platform's adaptive learning engine continuously monitors student engagement, quiz performance, and learning patterns to create personalized learning paths. Students receive customized content recommendations, difficulty-adjusted assessments, and targeted revision suggestions. The integrated AI Tutor uses Retrieval-Augmented Generation (RAG) to answer student doubts by referencing actual course material, ensuring accuracy and relevance. The system architecture is built on a modern cloud infrastructure with a React-based frontend, Supabase backend, and edge functions for serverless AI processing. Content is organized hierarchically: Courses → Subjects → Chapters → Topics, with each topic containing AI-generated video lectures, notes, MCQs, and practice problems. The platform also includes live class management with BigBlueButton integration, attendance tracking, class recordings with multi-quality HLS streaming, and a comprehensive admin dashboard for content management, user analytics, and automated content pipelines.",
  },
];

const detailedQuestions = [
  {
    question: "a) Is the Invention a Process, a Machine, an Article of Manufacture, or a Composition of Matter?",
    answer:
      "The invention is primarily a Process and a System (machine/apparatus in patent terminology). It encompasses: (1) A process for AI-driven lecture generation using avatar technology; (2) A process for automated multilingual audio dubbing of educational content; (3) A system for adaptive learning that dynamically adjusts educational content based on student performance analytics; (4) A software system (machine) that integrates AI tutoring, content management, assessment generation, and learning analytics into a unified platform. The invention is implemented as a cloud-based software system with specific algorithmic processes for content generation, language processing, and adaptive learning.",
  },
  {
    question: "b) Describe the Working of the Invention in Detail",
    answer:
      "The system operates through several interconnected workflows: (1) Content Ingestion & Processing — Educational content (PDFs, documents, structured text) is uploaded and processed through an AI pipeline. The system extracts key concepts, generates structured notes, creates MCQ question banks, and prepares content for avatar-based video generation. (2) AI Avatar Lecture Generation — Processed content is converted into video lectures using AI avatar technology. The system generates natural-looking avatar presentations with synchronized lip movements, gestures, and educational visuals. (3) Multilingual Dubbing Pipeline — Generated lectures pass through the dubbing pipeline where: Text content is translated while preserving technical terminology; Advanced TTS models generate natural-sounding audio in target languages; Audio is synchronized with avatar lip movements; Quality checks ensure educational accuracy. (4) Adaptive Learning Engine — As students interact with content, the system tracks: Video watch completion and engagement patterns; Quiz and assessment performance; Doubt patterns and difficulty areas; Daily login streaks and activity scores. This data feeds into the adaptive engine which adjusts content recommendations, suggests revision topics, and modifies assessment difficulty. (5) AI Doubt Resolution — When students ask questions, the RAG system retrieves relevant content from course materials, chapter notes, and topic documents, then generates contextually accurate answers using LLM technology. (6) Assessment & Feedback Loop — The system generates personalized daily practice problems, tracks performance across topics, and provides detailed analytics to both students and administrators.",
  },
  {
    question: "c) Critical Elements of the Invention — Important Steps, Components, Distinguishing Features",
    answer:
      "The critical elements that distinguish this invention are: (1) AI Avatar Content Engine — The proprietary pipeline that converts text-based educational content into avatar-presented video lectures, eliminating the traditional bottleneck of requiring human instructors for every lesson; (2) Real-Time Multilingual Dubbing System — The automated pipeline that translates and dubs content into 8+ Indian regional languages while maintaining educational accuracy and natural speech patterns; (3) Adaptive Learning Algorithm — The performance-tracking system that creates individualized learning paths based on continuous assessment of student engagement and comprehension; (4) RAG-Based AI Tutor — The doubt-resolution system that answers questions by retrieving relevant information from actual course materials rather than generic knowledge bases, ensuring contextually accurate responses; (5) Ultra-Affordable Delivery Model — The technology architecture that enables delivery of comprehensive, AI-powered education at ₹1000/year by eliminating human instructor dependency for content creation and leveraging cloud-based scalability; (6) Integrated Content Pipeline — The automated system for processing raw educational documents into structured, multi-format learning materials (videos, notes, MCQs, assignments) with minimal human intervention; (7) Multi-Quality Streaming Infrastructure — HLS-based video delivery with adaptive bitrate streaming (360p to 1080p) ensuring accessibility across varying internet speeds and devices.",
  },
  {
    question: "d) Relevant Keywords That Define the Invention",
    answer:
      "AI Avatar Lectures, Multilingual Dubbing, Adaptive Learning System, Learning Management System (LMS), Text-to-Speech (TTS), Retrieval-Augmented Generation (RAG), AI Tutoring, Personalized Learning Path, Affordable EdTech, Regional Language Education, Automated Content Pipeline, AI-Generated Assessments, Daily Practice Problems (DPP), Cloud-Based Education Platform, HLS Video Streaming, Natural Language Processing (NLP), Computer Vision, Speech Synthesis, Educational Analytics, Student Performance Tracking, Intelligent Content Delivery.",
  },
];

const InventionDisclosure = () => {
  return (
    <>
      <SEOHead
        title="Invention Disclosure Form — SimpleLecture AI-Powered LMS"
        description="Invention Disclosure Form for SimpleLecture's AI-Powered Multilingual Adaptive Learning Management System with AI Avatar-Based Lecture Generation."
        keywords="invention disclosure, patent, SimpleLecture, AI LMS, AI avatar lectures, multilingual dubbing, adaptive learning"
        canonicalUrl="https://simplelecture.com/invention-disclosure"
      />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="container mx-auto px-4 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <FileText className="w-4 h-4" />
              Invention Disclosure Form (IDF)
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 max-w-4xl mx-auto leading-tight">
              AI-Powered Multilingual Adaptive Learning Management System
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A comprehensive disclosure of the novel technologies behind SimpleLecture — AI avatar lectures, real-time multilingual dubbing, and adaptive learning at ₹1000/year.
            </p>
          </div>
        </section>

        {/* Section 1: Invention Details */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
              <span className="bg-primary/10 text-primary p-2 rounded-lg">
                <Lightbulb className="w-6 h-6" />
              </span>
              Section 1 — Invention Details
            </h2>
            <div className="space-y-6">
              {questions.map((q, index) => {
                const Icon = q.icon;
                return (
                  <Card key={index} className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-foreground flex items-start gap-3">
                        <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        {q.question}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {q.answer}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <Separator className="max-w-4xl mx-auto" />

        {/* Section 2: Detailed Description */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
              <span className="bg-primary/10 text-primary p-2 rounded-lg">
                <Cog className="w-6 h-6" />
              </span>
              Section 2 — Detailed Description (2/4)
            </h2>
            <div className="space-y-6">
              {detailedQuestions.map((q, index) => (
                <Card key={index} className="border-border/60 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {q.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                      {q.answer}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default InventionDisclosure;
