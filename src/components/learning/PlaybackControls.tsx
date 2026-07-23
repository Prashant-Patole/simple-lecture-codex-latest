import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Maximize, Minimize, X, User, Smartphone
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface PlaybackControlsProps {
  isPaused: boolean;
  onPlayPause: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  currentSlide: number;
  totalSlides: number;
  isFullScreen: boolean;
  onFullScreenToggle: () => void;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  progress: number;
  onSeek: (progress: number) => void;
  currentTime: string;
  totalTime: string;
  onExitPresentation: () => void;
  avatarUrl?: string | null;
  isSpeaking?: boolean;
  isProcessing?: boolean;
  lockedMobile?: boolean;
}

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export function PlaybackControls({
  isPaused,
  onPlayPause,
  onPrevSlide,
  onNextSlide,
  currentSlide,
  totalSlides,
  isFullScreen,
  onFullScreenToggle,
  isMinimized,
  onMinimizeToggle,
  playbackSpeed,
  onSpeedChange,
  progress,
  onSeek,
  currentTime,
  totalTime,
  onExitPresentation,
  avatarUrl,
  isSpeaking,
  isProcessing,
  lockedMobile,
}: PlaybackControlsProps) {
  const reactiveIsMobile = useIsMobile();
  const isMobile = lockedMobile !== undefined ? lockedMobile : reactiveIsMobile;

  const handlePortraitFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const btnSize = isMobile ? "h-7 w-7" : "h-8 w-8";
  const iconSize = isMobile ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={cn(
      "glass-controls",
      isMobile ? "px-2 py-1.5 rounded-xl mx-2 mb-2" : "px-4 py-2 rounded-2xl mx-4 mb-4"
    )}>
      {/* Single row: all controls inline */}
      <div className="flex items-center gap-2">
        {/* Left group: Avatar + Playback + Slide counter */}
        {!isMobile && (
          <div className={cn(
            "relative w-8 h-8 rounded-full overflow-hidden border-2 shrink-0 transition-all duration-300",
            isSpeaking ? "border-primary shadow-lg shadow-primary/30" : "border-primary/50",
            isProcessing && "animate-pulse"
          )}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Professor" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevSlide}
          disabled={currentSlide === 0}
          className={cn(btnSize, "p-0 rounded-full text-white hover:bg-white/20 disabled:text-white/40")}
        >
          <SkipBack className={iconSize} />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onPlayPause}
          className={cn(
            "p-0 rounded-full transition-all duration-300",
            "bg-gradient-to-r from-primary to-secondary",
            "hover:opacity-90 hover:scale-105",
            "shadow-lg",
            isMobile ? "h-8 w-8" : "h-10 w-10"
          )}
        >
          {isPaused ? (
            <Play className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4", "text-primary-foreground ml-0.5")} />
          ) : (
            <Pause className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4", "text-primary-foreground")} />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onNextSlide}
          disabled={currentSlide === totalSlides - 1}
          className={cn(btnSize, "p-0 rounded-full text-white hover:bg-white/20 disabled:text-white/40")}
        >
          <SkipForward className={iconSize} />
        </Button>
        
        <div className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20 shrink-0">
          <span className="text-xs font-medium text-white tabular-nums">
            {currentSlide + 1}/{totalSlides}
          </span>
        </div>

        {/* Middle group: Time + Slider (flex-1) */}
        <span className="text-xs text-white font-medium shrink-0 font-mono tabular-nums">
          {currentTime}
        </span>
        <div className="flex-1 min-w-[60px]">
          <Slider
            value={[progress]}
            onValueChange={(v) => onSeek(v[0])}
            max={100}
            step={1}
            className={cn(
              "relative z-10",
              "[&_[role=slider]]:h-3 [&_[role=slider]]:w-3",
              "[&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-primary [&_[role=slider]]:to-secondary",
              "[&_[role=slider]]:border-2 [&_[role=slider]]:border-background",
              "[&_[role=slider]]:shadow-lg [&_[role=slider]]:transition-transform",
              "[&_[role=slider]:hover]:scale-110",
              "[&_[data-orientation=horizontal]>.bg-primary]:bg-gradient-to-r [&_[data-orientation=horizontal]>.bg-primary]:from-primary [&_[data-orientation=horizontal]>.bg-primary]:to-secondary"
            )}
          />
        </div>
        <span className="text-xs text-white font-medium shrink-0 font-mono tabular-nums">
          {totalTime}
        </span>

        {/* Right group: Speed, Minimize, Fullscreen */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "px-2 text-xs rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 shrink-0",
                isMobile ? "h-7" : "h-8"
              )}
            >
              {playbackSpeed}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-strong">
            {speeds.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={cn(
                  "cursor-pointer",
                  speed === playbackSpeed && "bg-gradient-to-r from-primary/20 to-secondary/20"
                )}
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullScreenToggle}
            className={cn(btnSize, "p-0 rounded-full text-white hover:bg-white/20 shrink-0")}
            title="Fullscreen"
          >
            <Smartphone className={iconSize} />
          </Button>
        )}

        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMinimizeToggle}
            className="h-8 w-8 p-0 rounded-full text-white hover:bg-white/20 shrink-0"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <Minimize className="h-4 w-4" />
          </Button>
        )}

        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullScreenToggle}
            className="h-8 w-8 p-0 rounded-full text-white hover:bg-white/20 shrink-0"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
