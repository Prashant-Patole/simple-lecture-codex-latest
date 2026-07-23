import React, { useState, useEffect } from 'react';
import { Brain, BookOpen, Presentation, Image, Volume2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface PreparationStep {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface PreparationStepsAnimationProps {
  currentStep: number;
  subjectName?: string;
  className?: string;
  audioProgress?: { current: number; total: number };
  imageProgress?: { current: number; total: number };
}

const getSteps = (audioProgress?: { current: number; total: number }, imageProgress?: { current: number; total: number }): PreparationStep[] => [
  { id: 'analyzing', label: 'Analyzing your question', icon: <Brain className="w-5 h-5" /> },
  { id: 'research', label: 'Researching content', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'slides', label: 'Creating presentation slides', icon: <Presentation className="w-5 h-5" /> },
  { 
    id: 'visuals', 
    label: imageProgress && imageProgress.total > 0 
      ? `Loading visuals (${imageProgress.current}/${imageProgress.total})` 
      : 'Generating visuals', 
    icon: <Image className="w-5 h-5" /> 
  },
  { 
    id: 'audio', 
    label: audioProgress && audioProgress.total > 0 
      ? `Preparing audio (${audioProgress.current}/${audioProgress.total})` 
      : 'Preparing narration', 
    icon: <Volume2 className="w-5 h-5" /> 
  },
];

const funFacts = [
  "Did you know? The human brain can process images in as little as 13 milliseconds!",
  "Fun fact: Learning something new creates new neural pathways in your brain.",
  "Tip: Taking notes by hand improves memory retention by 29%.",
  "Did you know? Spaced repetition can increase retention by up to 200%.",
  "Fun fact: Teaching others is one of the most effective ways to learn.",
  "Tip: Taking short breaks while studying improves focus and retention.",
  "Did you know? Your brain uses 20% of your body's total energy.",
  "Fun fact: The more connections you make, the better you remember.",
];

export const PreparationStepsAnimation: React.FC<PreparationStepsAnimationProps> = ({
  currentStep,
  subjectName,
  className,
  audioProgress,
  imageProgress
}) => {
  const [currentFact, setCurrentFact] = useState(0);
  
  // Generate steps with current progress values
  const steps = getSteps(audioProgress, imageProgress);
  
  // Calculate progress including audio and image loading
  const baseProgress = Math.min(((currentStep + 1) / steps.length) * 70, 70); // Steps take 70%
  const audioPercent = audioProgress && audioProgress.total > 0 
    ? (audioProgress.current / audioProgress.total) * 15 
    : 15; // Audio takes 15%
  const imagePercent = imageProgress && imageProgress.total > 0 
    ? (imageProgress.current / imageProgress.total) * 15 
    : 15; // Images take 15%
  const progressPercentage = Math.min(baseProgress + audioPercent + imagePercent, 100);

  // Rotate fun facts
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFact(prev => (prev + 1) % funFacts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-[400px] p-6 relative overflow-hidden",
      className
    )}>
      {/* Background floating icons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[Brain, BookOpen, Presentation, Image, Volume2].map((Icon, i) => (
          <div
            key={i}
            className="absolute opacity-10 animate-float-bg"
            style={{
              left: `${10 + i * 20}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${4 + i}s`
            }}
          >
            <Icon className="w-12 h-12 text-primary" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Preparing your lesson{subjectName ? ` on ${subjectName}` : ''}
          </h3>
          <p className="text-sm text-muted-foreground">
            Creating an engaging learning experience just for you
          </p>
        </div>

        {/* Steps list */}
        <div className="space-y-3 mb-8">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isPending = index > currentStep;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl transition-all duration-500",
                  isCompleted && "bg-success/10 border border-success/30",
                  isActive && "bg-primary/10 border border-primary/30 shadow-lg shadow-primary/10",
                  isPending && "bg-muted/30 border border-transparent opacity-50"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon container */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
                  isCompleted && "bg-success text-success-foreground",
                  isActive && "bg-primary text-primary-foreground animate-pulse",
                  isPending && "bg-muted text-muted-foreground"
                )}>
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Label */}
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isCompleted && "text-success",
                  isActive && "text-primary",
                  isPending && "text-muted-foreground"
                )}>
                  {step.label}
                  {isActive && <span className="ml-1 animate-pulse">...</span>}
                </span>

                {/* Completion indicator */}
                {isCompleted && (
                  <span className="ml-auto text-xs text-success animate-fade-in">Done</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Fun fact */}
        <div className="p-4 bg-accent/10 rounded-xl border border-accent/20 animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <p className="text-sm text-muted-foreground leading-relaxed" key={currentFact}>
              {funFacts[currentFact]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
