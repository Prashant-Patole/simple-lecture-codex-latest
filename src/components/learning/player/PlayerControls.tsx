import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Palette,
} from 'lucide-react';
import { formatTime } from './utils/timingUtils';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import '@/components/learning/player/player.css';

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  audioRef?: React.RefObject<HTMLAudioElement | HTMLVideoElement>;
  sectionPicker?: React.ReactNode;
  languagePicker?: React.ReactNode;
  playbackRate?: number;
  onSpeedChange?: (speed: number) => void;
  onOpenChromaTuner?: () => void;
  forceMobileLayout?: boolean;
  className?: string;
}

export const PlayerControls = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  isFullscreen = false,
  onToggleFullscreen,
  audioRef,
  sectionPicker,
  languagePicker,
  playbackRate = 1,
  onSpeedChange,
  onOpenChromaTuner,
  forceMobileLayout = false,
  className,
}: PlayerControlsProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const viewportMobile = useIsMobile();
  const isMobile = forceMobileLayout || viewportMobile;

  const handleVolumeToggle = useCallback(() => {
    if (audioRef?.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [audioRef, isMuted, volume]);

  const handleSpeedCycle = useCallback(() => {
    if (!onSpeedChange) return;
    const currentIdx = SPEED_STEPS.indexOf(playbackRate);
    const nextIdx = (currentIdx + 1) % SPEED_STEPS.length;
    onSpeedChange(SPEED_STEPS[nextIdx]);
  }, [playbackRate, onSpeedChange]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    onSeek(Math.max(0, Math.min(duration, newTime)));
  }, [duration, onSeek]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("player-controls", className)}>
      {/* Mobile: Timeline row with flanking time labels */}
      {isMobile && (
        <div className="mobile-timeline-row">
          <span className="mobile-time-label">{formatTime(currentTime)}</span>
          <div className="timeline-container" onClick={handleTimelineClick}>
            <div className="timeline-progress" style={{ width: `${progress}%` }} />
            <div className="timeline-handle" style={{ left: `${progress}%` }} />
          </div>
          <span className="mobile-time-label">{formatTime(duration)}</span>
        </div>
      )}

      {/* Desktop: Left - Volume & Time */}
      {!isMobile && (
        <div className="controls-left">
          <button 
            className="control-button" 
            onClick={handleVolumeToggle}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Desktop: Timeline */}
      {!isMobile && (
        <div className="timeline-container" onClick={handleTimelineClick}>
          <div className="timeline-progress" style={{ width: `${progress}%` }} />
          <div className="timeline-handle" style={{ left: `${progress}%` }} />
        </div>
      )}
      
      {/* Mobile: Left group — language picker (always render spacer for centering) */}
      {isMobile && (
        <div className="mobile-controls-left controls-language-picker">
          {languagePicker}
        </div>
      )}

      {/* Center - Playback */}
      <div className="controls-center">
        <button className="control-button" onClick={onPrevious} disabled={!hasPrevious} title="Previous Section">
          <SkipBack className="h-5 w-5" />
        </button>
        <button className="control-button primary" onClick={onPlayPause} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </button>
        <button className="control-button" onClick={onNext} disabled={!hasNext} title="Next Section">
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile: Right group — sections / speed / chroma / fullscreen */}
      {isMobile && (
        <div className="mobile-controls-right">
          {sectionPicker && (
            <div className="controls-section-picker">
              {sectionPicker}
            </div>
          )}
          {onSpeedChange && (
            <button className="control-button" onClick={handleSpeedCycle} title="Playback Speed">
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{playbackRate}x</span>
            </button>
          )}
          {onOpenChromaTuner && (
            <button className="control-button" onClick={onOpenChromaTuner} title="Green-screen settings">
              <Palette className="h-4 w-4" />
            </button>
          )}
          {onToggleFullscreen && (
            <button 
              className="control-button mobile-fullscreen-btn" 
              onClick={onToggleFullscreen} 
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}

      {/* Desktop: Section Picker (between center and right) */}
      {!isMobile && sectionPicker && (
        <div className="controls-section-picker">
          {sectionPicker}
        </div>
      )}

      {/* Desktop: Language Picker */}
      {!isMobile && languagePicker && (
        <div className="controls-language-picker">
          {languagePicker}
        </div>
      )}
      
      {/* Desktop: Right - Speed / Chroma / Fullscreen */}
      {!isMobile && (
        <div className="controls-right">
          {onSpeedChange && (
            <button className="control-button" onClick={handleSpeedCycle} title="Playback Speed">
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{playbackRate}x</span>
            </button>
          )}
          {onOpenChromaTuner && (
            <button className="control-button" onClick={onOpenChromaTuner} title="Green-screen settings (Ctrl+D)">
              <Palette className="h-5 w-5" />
            </button>
          )}
          {onToggleFullscreen && (
            <button className="control-button" onClick={onToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
