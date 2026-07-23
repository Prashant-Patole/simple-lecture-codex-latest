import { useState, useRef } from 'react';


import { SPEED_STEPS } from './constants';
import type { V4Section, SubtitleMode } from './types';


interface V4BottomBarProps {
  sections: V4Section[];
  currentIndex: number;
  isPlaying: boolean;
  playbackRate: number;
  progress: number;
  currentTime: number;
  totalTime: number;
  isMuted: boolean;
  subtitleMode: SubtitleMode;
  isMobile?: boolean;
  alwaysEnableNav?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (rate: number) => void;
  onSubtitleToggle: () => void;
  onSeek: (percent: number) => void;
  onToggleVolume: () => void;
  onToggleFullscreen: () => void;
  onSectionClick: (index: number) => void;
}

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const V4BottomBar = ({
  sections,
  currentIndex,
  isPlaying,
  playbackRate,
  progress,
  currentTime,
  totalTime,
  isMuted,
  subtitleMode,
  isMobile,
  alwaysEnableNav,
  onPrev,
  onNext,
  onTogglePlay,
  onSpeedChange,
  onSubtitleToggle,
  onSeek,
  onToggleVolume,
  onToggleFullscreen,
  onSectionClick,
}: V4BottomBarProps) => {
  void onSectionClick;



  const cycleSpeed = () => {
    const idx = SPEED_STEPS.indexOf(playbackRate);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    onSpeedChange(next);
  };

  const [dragPct, setDragPct] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const computePct = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    const pct = computePct(e.clientX, el);
    setDragPct(pct);
    onSeek(pct);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const pct = computePct(e.clientX, e.currentTarget);
    setDragPct(pct);
    onSeek(pct);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    setDragPct(null);
  };

  const trackProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
  const displayPct = dragPct !== null ? dragPct * 100 : progress;

  // Mobile: two-row layout
  if (isMobile) {
    return (
      <div className="v4-botbar">
        {/* Row 1: Timeline */}
        <div className="v4-bb-timeline-row">
          <span className="v4-bb-time">{formatTime(currentTime)}</span>
          <div className="v4-prog-track v4-prog-seekable" {...trackProps}>
            <div className="v4-prog-fill" style={{ width: `${displayPct}%` }} />
          </div>
          <span className="v4-bb-time">{formatTime(totalTime)}</span>
        </div>

        {/* Row 2: Controls */}
        <div className="v4-bb-controls-row">
          <button className="v4-nb" onClick={onPrev} disabled={!alwaysEnableNav && currentIndex <= 0} title="Previous">
            ◀
          </button>
          <button className="v4-pb" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button className="v4-nb" onClick={onNext} disabled={!alwaysEnableNav && currentIndex >= sections.length - 1} title="Next">
            ▶
          </button>
          <button className="v4-nb" onClick={onToggleVolume} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            className={`v4-nb${subtitleMode === 'off' ? '' : ' v4-nb--active'}`}
            onClick={onSubtitleToggle}
            title={`Subtitles: ${subtitleMode}`}
            style={{ fontSize: 11, fontWeight: 700, opacity: subtitleMode === 'off' ? 0.4 : 1 }}
          >
            CC
          </button>

          <div className="v4-bb-right-group">
            <button className="v4-nb" onClick={cycleSpeed} title={`Speed: ${playbackRate}×`}>
              {playbackRate}×
            </button>
            <button className="v4-nb" onClick={onToggleFullscreen} title="Fullscreen">
              ⛶
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Desktop: single-row layout
  return (
    <div className="v4-botbar">
      <div className="v4-bb-left">
        <button className="v4-nb" onClick={onPrev} disabled={!alwaysEnableNav && currentIndex <= 0} title="Previous">
          ◀
        </button>
        <button className="v4-pb" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button className="v4-nb" onClick={onNext} disabled={!alwaysEnableNav && currentIndex >= sections.length - 1} title="Next">
          ▶
        </button>
        <button className="v4-nb" onClick={onToggleVolume} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="v4-bb-center">
        <span className="v4-bb-time">{formatTime(currentTime)}</span>
        <div className="v4-prog-track v4-prog-seekable" {...trackProps}>
          <div className="v4-prog-fill" style={{ width: `${displayPct}%` }} />
        </div>
        <span className="v4-bb-time">{formatTime(totalTime)}</span>
      </div>

      <div className="v4-bb-right">

        <button
          className={`v4-nb${subtitleMode === 'off' ? '' : ' v4-nb--active'}`}
          onClick={onSubtitleToggle}
          title={`Subtitles: ${subtitleMode}`}
          style={{ fontSize: 11, fontWeight: 700, opacity: subtitleMode === 'off' ? 0.4 : 1 }}
        >
          CC
        </button>
        <button className="v4-nb" onClick={cycleSpeed} title={`Speed: ${playbackRate}×`}>
          {playbackRate}×
        </button>
        <button className="v4-nb" onClick={onToggleFullscreen} title="Fullscreen">
          ⛶
        </button>
      </div>
    </div>
  );
};
