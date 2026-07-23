import { useState, useEffect } from "react";
import { Star, FileText, Brain, Headphones, ClipboardCheck, BookOpen, Video, Award, Sparkles, Target } from "lucide-react";
import { Card } from "@/components/ui/card";

const instructions = [
  { icon: Star, text: "Star important questions and find them easily in your tests!", gradient: "from-yellow-500/20 to-orange-500/20", borderColor: "border-yellow-500/50", iconColor: "text-yellow-500" },
  { icon: FileText, text: "Previous year papers are waiting - practice like the real exam!", gradient: "from-primary/20 to-cyan-500/20", borderColor: "border-primary/50", iconColor: "text-primary" },
  { icon: Brain, text: "Got stuck? Ask our AI Assistant - it never sleeps!", gradient: "from-primary/20 to-pink-500/20", borderColor: "border-primary/50", iconColor: "text-primary" },
  { icon: Headphones, text: "Listen to podcasts while chilling - learn on the go!", gradient: "from-green-500/20 to-emerald-500/20", borderColor: "border-green-500/50", iconColor: "text-green-500" },
  { icon: ClipboardCheck, text: "Track your progress with MCQs after every topic!", gradient: "from-orange-500/20 to-red-500/20", borderColor: "border-orange-500/50", iconColor: "text-orange-500" },
  { icon: BookOpen, text: "Notes are your best friends - read them anytime, anywhere!", gradient: "from-pink-500/20 to-rose-500/20", borderColor: "border-pink-500/50", iconColor: "text-pink-500" },
  { icon: Video, text: "Watch video lectures at your own pace - pause, rewind, repeat!", gradient: "from-red-500/20 to-orange-500/20", borderColor: "border-red-500/50", iconColor: "text-red-500" },
  { icon: Award, text: "Complete assignments to unlock your potential!", gradient: "from-primary/20 to-primary/20", borderColor: "border-primary/50", iconColor: "text-primary" },
  { icon: Target, text: "DPT tests help you master the trickiest questions!", gradient: "from-teal-500/20 to-cyan-500/20", borderColor: "border-teal-500/50", iconColor: "text-teal-500" },
  { icon: Sparkles, text: "Select a chapter from the sidebar to begin your journey!", gradient: "from-amber-500/20 to-yellow-500/20", borderColor: "border-amber-500/50", iconColor: "text-amber-500" },
];

interface CourseWelcomeCardsProps {
  courseName: string;
}

export function CourseWelcomeCards({ courseName }: CourseWelcomeCardsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % instructions.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold mb-2">Welcome to {courseName}!</h3>
        <p className="text-muted-foreground">Here's what you can do here</p>
      </div>

      {/* Carousel Container */}
      <div className="relative h-[310px] w-full max-w-4xl flex items-center justify-center overflow-hidden">
        {instructions.map((item, index) => {
          const isActive = index === activeIndex;
          const isPrev = index === (activeIndex - 1 + instructions.length) % instructions.length;
          const isNext = index === (activeIndex + 1) % instructions.length;
          
          return (
            <Card 
              key={index}
              className={`
                absolute transition-all duration-700 ease-in-out
                p-6 flex items-center gap-5 
                bg-gradient-to-br ${item.gradient} 
                border-2 ${item.borderColor}
                backdrop-blur-sm
                ${isActive 
                  ? 'scale-100 opacity-100 blur-none z-20' 
                  : isPrev || isNext
                    ? 'scale-75 opacity-40 blur-sm z-10'
                    : 'scale-50 opacity-0 blur-md z-0'
                }
                ${isPrev ? '-translate-y-24' : isNext ? 'translate-y-24' : ''}
              `}
              style={{ width: '500px', maxWidth: '90vw' }}
            >
              <div className={`p-4 rounded-xl bg-background/80 ${item.iconColor} shrink-0`}>
                <item.icon className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-foreground">{item.text}</p>
            </Card>
          );
        })}
      </div>

      {/* Progress Dots */}
      <div className="flex gap-2 mt-6">
        {instructions.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === activeIndex 
                ? 'w-6 bg-primary' 
                : 'w-2 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
