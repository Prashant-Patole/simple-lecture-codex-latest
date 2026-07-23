import { Link } from "react-router-dom";
import { Brain, Users, Target, TrendingUp } from "lucide-react";

const sections = [
  {
    icon: Brain,
    question: "What Is SimpleLecture?",
    answer:
      "SimpleLecture is India's first AI-powered learning platform for students preparing for SSLC, PUC, NEET, and JEE exams. It offers 24/7 AI tutoring, chapter-wise video lessons, adaptive practice tests, and doubt clearing — all at ₹1000/year, making quality education accessible to every student.",
    bullets: [
      "AI tutors available in Kannada, Hindi & English",
      "Chapter-wise video lessons aligned with board syllabi",
      "Adaptive mock tests that match exam patterns",
    ],
    link: { text: "Explore all courses →", href: "/programs" },
  },
  {
    icon: Target,
    question: "How Does AI Personalize Your Learning?",
    answer:
      "Our AI engine analyzes your performance after every question and adapts in real time. It identifies weak topics, generates targeted practice sets, and provides step-by-step explanations until you achieve mastery — ensuring you never waste time on concepts you've already learned.",
    bullets: [
      "Real-time weak-area detection & targeted revision",
      "AI-generated practice papers matching board patterns",
      "Step-by-step doubt clearing available 24/7",
    ],
    link: { text: "See how it works →", href: "/about" },
  },
  {
    icon: Users,
    question: "Who Is SimpleLecture For?",
    answer:
      "SimpleLecture serves students across India preparing for 10th SSLC board exams, PUC/12th boards, NEET medical entrance, JEE engineering entrance, Pharmacy (D.Pharm/B.Pharm), Nursing (GNM/B.Sc Nursing), and competitive exams like UPSC and banking. Parents and working professionals pursuing skill development also benefit from our platform.",
    bullets: [
      "SSLC & PUC board exam students (State & CBSE Boards)",
      "NEET, JEE, Pharmacy & Nursing entrance aspirants",
      "Competitive exam candidates & skill learners",
    ],
    link: { text: "Find your course →", href: "/programs" },
  },
  {
    icon: TrendingUp,
    question: "Why Choose AI Tutoring Over Traditional Coaching?",
    answer:
      "Traditional coaching costs ₹50,000–₹2,00,000 per year and is limited to fixed schedules. SimpleLecture's AI tutors are available 24/7 at just ₹1000/year, provide unlimited doubt clearing, and adapt to your learning pace — delivering a personalized experience impossible in a classroom of 50+ students.",
    bullets: [
      "99% lower cost than traditional coaching centres",
      "Learn anytime, anywhere — no commute needed",
      "Unlimited practice & instant AI feedback",
    ],
    link: null as { text: string; href: string } | null,
  },
];

export const AISearchContentSection = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article key={section.question} className="bg-card rounded-2xl p-6 lg:p-8 border shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold">{section.question}</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {section.answer}
                </p>
                <ul className="space-y-2 mb-4">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-1">✓</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {section.link && (
                  <Link to={section.link.href} onClick={() => window.scrollTo(0, 0)} className="text-primary font-medium text-sm hover:underline">
                    {section.link.text}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
