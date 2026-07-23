import { ConversationStage } from "@/hooks/useSalesAssistant";
import { Check } from "lucide-react";

interface ConversationStageIndicatorProps {
  currentStage: ConversationStage;
}

export const ConversationStageIndicator = ({ currentStage }: ConversationStageIndicatorProps) => {
  const stages: { id: ConversationStage; label: string; icon: string }[] = [
    { id: "greeting", label: "Greeting", icon: "👋" },
    { id: "discovery", label: "Discovery", icon: "🔍" },
    { id: "consultation", label: "Consultation", icon: "💡" },
    { id: "closing", label: "Closing", icon: "✅" },
  ];

  const stageIndex = stages.findIndex((s) => s.id === currentStage);

  return (
    <div className="w-full py-3 px-4 bg-muted/30 border-b">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {stages.map((stage, index) => {
          const isCompleted = index < stageIndex;
          const isCurrent = index === stageIndex;
          const isUpcoming = index > stageIndex;

          return (
            <div key={stage.id} className="flex items-center flex-1">
              {/* Stage indicator */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    isCurrent
                      ? "bg-primary text-primary-foreground scale-110 animate-pulse"
                      : isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground opacity-50"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-lg">{stage.icon}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-all ${
                    isCurrent
                      ? "text-foreground"
                      : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground opacity-50"
                  }`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connecting line */}
              {index < stages.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 relative">
                  <div className="absolute inset-0 bg-muted" />
                  <div
                    className={`absolute inset-0 bg-primary transition-all duration-500 ${
                      index < stageIndex ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
