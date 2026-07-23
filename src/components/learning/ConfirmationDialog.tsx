import React from 'react';
import { Check, X, Sparkles, BookOpen, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  question: string;
  suggestedTopic: string;
  topicDescription: string;
  relatedConcepts: string[];
  onConfirm: () => void;
  onDecline: () => void;
  className?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  question,
  suggestedTopic,
  topicDescription,
  relatedConcepts,
  onConfirm,
  onDecline,
  className
}) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-[400px] p-6 animate-scale-in",
      className
    )}>
      {/* AI Avatar */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark 
                      flex items-center justify-center shadow-lg shadow-primary/30 animate-float-gentle">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success 
                      flex items-center justify-center border-2 border-background">
          <Lightbulb className="w-3 h-3 text-success-foreground" />
        </div>
      </div>

      {/* AI Conversational Message */}
      <div className="text-center mb-8 max-w-lg animate-fade-in" style={{ animationDelay: '200ms' }}>
        <h3 className="text-xl font-semibold text-foreground mb-3">
          Great question! Let me help you understand this concept.
        </h3>
        <p className="text-muted-foreground mb-4">
          You asked: <span className="text-foreground font-medium">"{question}"</span>
        </p>
        <p className="text-sm text-muted-foreground">
          I've analyzed your question and here's what I found for you...
        </p>
      </div>

      {/* Topic Section - No Card, Just Content */}
      <div className="w-full max-w-lg text-center mb-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
        {/* Topic Title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {suggestedTopic}
          </h2>
        </div>

        {/* Detailed Description */}
        <p className="text-muted-foreground leading-relaxed mb-6">
          {topicDescription} This is an important concept that will help you understand 
          how things work in the real world, from everyday phenomena to advanced applications!
        </p>

        {/* What You'll Learn */}
        {relatedConcepts.length > 0 && (
          <div className="text-left bg-muted/30 rounded-xl p-5 mb-4">
            <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              What you'll learn:
            </p>
            <ul className="space-y-2">
              {relatedConcepts.map((concept, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground animate-fade-in"
                  style={{ animationDelay: `${400 + index * 100}ms` }}
                >
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Understand <span className="text-foreground font-medium">{concept}</span> and how it applies</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Estimated Time */}
        <p className="text-xs text-muted-foreground">
          ⏱️ Estimated lesson time: 8-10 minutes
        </p>
      </div>

      {/* Confirmation Question */}
      <p className="text-sm text-muted-foreground mb-4 animate-fade-in" style={{ animationDelay: '450ms' }}>
        Is this what you'd like to learn about?
      </p>

      {/* Action Buttons */}
      <div className="flex gap-4 animate-fade-in" style={{ animationDelay: '500ms' }}>
        <Button
          onClick={onConfirm}
          size="lg"
          className="gap-2 bg-gradient-to-r from-primary to-primary-dark hover:opacity-90 
                   shadow-lg shadow-primary/30 px-8"
        >
          <Check className="w-5 h-5" />
          Yes, teach me!
        </Button>
        <Button
          onClick={onDecline}
          variant="outline"
          size="lg"
          className="gap-2 border-border/50 hover:bg-destructive/10 hover:text-destructive 
                   hover:border-destructive/50 px-8"
        >
          <X className="w-5 h-5" />
          Not quite
        </Button>
      </div>
    </div>
  );
};
