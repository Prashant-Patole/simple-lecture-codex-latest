import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatV5Time } from './utils';

interface V5ControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onReplay: () => void;
  onSeek: (time: number) => void;
  onRateChange: (rate: number) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function V5Controls({
  isPlaying,
  isMuted,
  isFullscreen,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onReplay,
  onSeek,
  onRateChange,
}: V5ControlsProps) {
  return (
    <div className="v5-controls">
      <div className="v5-controls__timeline">
        <span>{formatV5Time(currentTime)}</span>
        <input
          aria-label="Presentation progress"
          max={Math.max(duration, 0)}
          min={0}
          onChange={(event) => onSeek(Number(event.target.value))}
          step={0.05}
          type="range"
          value={Math.min(currentTime, duration || 0)}
          style={{
            '--v5-progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
          } as React.CSSProperties}
        />
        <span>{formatV5Time(duration)}</span>
      </div>

      <div className="v5-controls__actions">
        <div className="v5-controls__group">
          <button onClick={onReplay} title="Replay" type="button">
            <RotateCcw size={18} />
          </button>
          <button
            className="v5-controls__play"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            type="button"
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
          </button>
          <button onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'} type="button">
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <div className="v5-controls__group">
          <select
            aria-label="Playback speed"
            onChange={(event) => onRateChange(Number(event.target.value))}
            value={playbackRate}
          >
            {SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            type="button"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

