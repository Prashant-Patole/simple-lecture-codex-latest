import { CheckCircle, Users, Brain, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CourseAIContentSectionProps {
  courseName: string;
  category: string | null;
  whatYouLearn: any[];
  price?: number | null;
  originalPrice?: number | null;
}

const categoryAudienceMap: Record<string, string[]> = {
  "SSLC": [
    "10th-standard students preparing for Karnataka SSLC board exams",
    "Students who want to score 90+ in Maths, Science, and Social Studies",
    "Parents looking for affordable, high-quality coaching alternatives",
    "Students who need 24/7 doubt clearing in Kannada, Hindi, or English",
  ],
  "PUC": [
    "1st and 2nd PUC students across Science, Commerce, and Arts streams",
    "Students preparing for university entrance alongside board exams",
    "Learners who need flexible, self-paced study schedules",
    "Students who want AI-powered revision and weak-topic analysis",
  ],
  "NEET": [
    "Students preparing for NEET-UG medical entrance examination",
    "12th-standard Science students aiming for top medical colleges",
    "Repeaters and droppers looking for focused, AI-guided preparation",
    "Students who need chapter-wise practice with instant doubt clearing",
  ],
  "JEE": [
    "Students preparing for JEE Main and JEE Advanced engineering entrance",
    "11th and 12th PCM students targeting IITs and NITs",
    "Self-study learners who need structured AI-guided practice",
    "Students looking for affordable alternatives to expensive coaching centres",
  ],
  "Pharmacy": [
    "Students preparing for D.Pharm and B.Pharm entrance exams",
    "12th-standard Science students exploring pharmacy career paths",
    "Learners looking for comprehensive pharmacy subject preparation",
    "Students who need AI-powered practice tests for pharmacy entrance",
  ],
  "Nursing": [
    "Students preparing for GNM and B.Sc Nursing entrance exams",
    "12th-standard students aspiring to join nursing colleges",
    "Working professionals seeking nursing career advancement",
    "Students who need flexible, mobile-friendly nursing exam preparation",
  ],
};

const defaultAudience = [
  "Students looking to excel in their academic examinations",
  "Learners who want personalised, AI-driven study plans",
  "Parents seeking affordable, high-quality online education",
  "Students who need 24/7 doubt clearing and practice tests",
];

export const CourseAIContentSection = ({
  courseName,
  category,
  whatYouLearn,
  price,
  originalPrice,
}: CourseAIContentSectionProps) => {
  const audience = (category && categoryAudienceMap[category]) || defaultAudience;
  const savings = originalPrice && price && originalPrice > price
    ? Math.round((1 - price / originalPrice) * 100)
    : null;

  return (
    <section className="space-y-6">
      {/* What Will You Learn */}
      {whatYouLearn.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Trophy className="h-5 w-5 text-primary" />
              What Will You Learn in {courseName}?
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Master every concept with AI-powered lessons, unlimited practice, and instant doubt clearing — designed to help you score higher with less effort.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="grid gap-2 md:grid-cols-2">
              {whatYouLearn.map((point, i) => {
                const text = typeof point === "string" ? point : (point as any)?.text || (point as any)?.title || "";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Who Is This Course For */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Users className="h-5 w-5 text-primary" />
            Who Is {courseName} For?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ul className="grid gap-2">
            {audience.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* How Does AI Personalization Work */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Brain className="h-5 w-5 text-primary" />
            How Does AI Personalization Work in {courseName}?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Our AI tutor adapts to your learning pace in {courseName}. It identifies weak topics, generates targeted practice questions, and provides step-by-step explanations — available 24/7 in English, Hindi, and Kannada.
          </p>
          <ul className="grid gap-2">
            {[
              "Adaptive learning paths that adjust to your strengths and weaknesses",
              "Instant AI doubt clearing — ask questions anytime, get answers in seconds",
              "Smart practice tests that focus on topics you haven't mastered yet",
              "Progress tracking with actionable insights for parents and students",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Why Choose Over Traditional Coaching */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Trophy className="h-5 w-5 text-primary" />
            Why Choose {courseName} Over Traditional Coaching?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                label: "Cost",
                traditional: "₹30,000–₹1,00,000/year",
                ours: price ? `₹${price.toLocaleString()}/year${savings ? ` (${savings}% off)` : ""}` : "Affordable pricing",
              },
              {
                label: "Doubt Clearing",
                traditional: "Limited to class hours",
                ours: "24/7 AI-powered, instant responses",
              },
              {
                label: "Personalisation",
                traditional: "One-size-fits-all batch teaching",
                ours: "AI adapts to your weak topics",
              },
              {
                label: "Accessibility",
                traditional: "Travel to coaching centre daily",
                ours: "Learn anywhere on mobile or desktop",
              },
            ].map((row, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-primary">{row.label}</p>
                <p className="text-xs text-muted-foreground line-through">{row.traditional}</p>
                <p className="text-sm font-medium">{row.ours}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
