import { ConversationState } from "@/hooks/useSalesAssistant";
import { AudioWaveform } from "./AudioWaveform";
import { Loader2 } from "lucide-react";

interface VoiceStatusIndicatorProps {
  state: ConversationState;
  gender: "female" | "male";
  avatarUrl?: string;
  onTap?: () => void;
  isGenerating?: boolean;
  isVADActive?: boolean;
  vadLevel?: number;
}

export const VoiceStatusIndicator = ({ 
  state, 
  gender, 
  avatarUrl, 
  onTap,
  isGenerating,
  isVADActive,
  vadLevel = 0
}: VoiceStatusIndicatorProps) => {
  const getStateConfig = () => {
    switch (state) {
      case "listening":
        return { text: "Listening...", pulse: true, color: "border-green-500" };
      case "speaking":
        return { text: "Speaking...", pulse: true, color: "border-primary" };
      case "processing":
        return { text: "Processing...", pulse: false, color: "border-yellow-500" };
      default:
        return { text: "Tap to start", pulse: false, color: "border-border" };
    }
  };

  const config = getStateConfig();
  const counselorName = gender === "male" ? "Rahul" : "Priya";

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-4"
      onClick={onTap}
    >
      {/* Full Section Avatar Display */}
      <div className="relative w-full max-w-sm aspect-[3/4] overflow-hidden rounded-2xl shadow-2xl">
        {/* Glow Effect based on state */}
        <div className={`absolute -inset-1 rounded-2xl transition-all duration-300 ${
          state === "speaking" 
            ? "bg-primary/30 animate-pulse" 
            : state === "listening"
            ? "bg-green-500/30 animate-pulse"
            : state === "processing"
            ? "bg-yellow-500/30"
            : "bg-transparent"
        }`} />

        {/* Avatar Container */}
        <div className={`relative w-full h-full rounded-2xl overflow-hidden border-4 transition-all duration-300 ${config.color}`}>
          {isGenerating ? (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex flex-col items-center justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Loading avatar...</p>
            </div>
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${counselorName} - Educational Counselor`}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("Avatar image failed to load");
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
              <div className="text-8xl">
                {gender === "male" ? "👨‍💼" : "👩‍💼"}
              </div>
            </div>
          )}

          {/* Gradient Overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
            {/* Counselor Name */}
            <p className="text-white text-xl font-bold">{counselorName}</p>
            <p className="text-white/80 text-sm">Educational Counselor</p>
          </div>

          {/* Processing Overlay */}
          {state === "processing" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-16 w-16 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Speaking Animation Ring */}
        {state === "speaking" && (
          <>
            <div 
              className="absolute -inset-2 rounded-2xl border-4 border-primary/50"
              style={{ animation: 'speak-ripple 1.5s ease-out infinite' }}
            />
            <div 
              className="absolute -inset-4 rounded-2xl border-2 border-primary/30"
              style={{ animation: 'speak-ripple 1.5s ease-out infinite 0.75s' }}
            />
          </>
        )}

        {/* Listening Animation Ring */}
        {state === "listening" && (
          <>
            <div 
              className="absolute -inset-2 rounded-2xl border-4 border-green-500/50"
              style={{ animation: 'speak-ripple 1.5s ease-out infinite' }}
            />
          </>
        )}
      </div>

      {/* Audio Waveform - below avatar */}
      <div className="mt-4">
        <AudioWaveform 
          isActive={state === "speaking"} 
          color={state === "speaking" ? "bg-primary" : "bg-muted"} 
        />
      </div>

      {/* Status Text */}
      <p className="text-lg font-medium text-foreground mt-3">{config.text}</p>
      
      {/* VAD Indicator */}
      {state === "speaking" && isVADActive && (
        <div className="mt-2 flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600 font-medium">Listening for interrupt</span>
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${Math.min(100, (vadLevel / 60) * 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Hint for interruption */}
      {state === "speaking" && (
        <p className="text-sm text-muted-foreground mt-2 animate-bounce">
          Tap or speak to interrupt
        </p>
      )}
    </div>
  );
};
