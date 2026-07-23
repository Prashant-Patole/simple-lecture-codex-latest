import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Search, BookOpen, Brain, Trophy, MessageCircle, BarChart3, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "1. Pick Your Course",
    body: "Browse programs for CBSE, PUC, SSLC and Pharmacy. Every course is mapped to your real syllabus and board.",
  },
  {
    icon: BookOpen,
    title: "2. Enroll in Minutes",
    body: "A single subscription unlocks all lectures, tests, doubt support and progress tools for the full course duration.",
  },
  {
    icon: Brain,
    title: "3. Learn with AI Lectures",
    body: "Short, chapter-wise AI lectures with avatars explain each topic in simple language, including regional languages where available.",
  },
  {
    icon: MessageCircle,
    title: "4. Clear Doubts Instantly",
    body: "Ask the in-built AI tutor any doubt, any time. Get step-by-step solutions without waiting for class.",
  },
  {
    icon: Trophy,
    title: "5. Practice & Master",
    body: "Auto-generated MCQs, chapter tests and previous-year papers help you practice until each concept is fully mastered.",
  },
  {
    icon: BarChart3,
    title: "6. Track Progress",
    body: "Your dashboard shows chapter-wise progress, weak areas and attendance, so you always know what to study next.",
  },
];

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <Badge className="mb-4">How It Works</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            A simpler way to <span className="bg-gradient-primary bg-clip-text text-transparent">prepare and score</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            SimpleLecture combines AI-powered lectures, instant doubt solving, and mastery-based practice so every student can learn at their own pace at 99% lower cost than traditional coaching.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {steps.map((s, i) => (
            <Card key={i} className="hover:shadow-hover transition-all">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <s.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-muted/40 rounded-2xl p-8 md:p-12 max-w-4xl mx-auto text-center">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for Indian students and parents</h2>
          <p className="text-muted-foreground mb-6">
            Affordable annual plans, regional language support, parent-friendly progress reports and content prepared by experienced educators — that's why thousands of families trust SimpleLecture.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg"><Link to="/programs">Explore Courses</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/success-stories">Read Success Stories</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HowItWorks;
