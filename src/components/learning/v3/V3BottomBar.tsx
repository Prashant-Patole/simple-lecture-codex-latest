import { useState } from 'react';
import { SPEED_STEPS } from './constants';
import { V3SectionsPanel } from './V3SectionsPanel';
import type { V3Section, SubtitleMode } from './types';

interface V3BottomBarProps {
  sections: V3Section[];
  currentIndex: number;
  isPlaying: boolean;
  playbackRate: number;
  progress: number;
  currentTime: number;
  totalTime: number;
  isMuted: boolean;
  subtitleMode: SubtitleMode;
  isMobile?: boolean;
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

export const V3BottomBar = ({
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
  onPrev,
  onNext,
  onTogglePlay,
  onSpeedChange,
  onSubtitleToggle,
  onSeek,
  onToggleVolume,
  onToggleFullscreen,
  onSectionClick,
}: V3BottomBarProps) => {
  const [showSections, setShowSections] = useState(false);

  const cycleSpeed = () => {
    const idx = SPEED_STEPS.indexOf(playbackRate);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    onSpeedChange(next);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  // Mobile: two-row layout
  if (isMobile) {
    return (
      <div className="v3-botbar">
        {/* Row 1: Timeline */}
        <div className="v3-bb-timeline-row">
          <span className="v3-bb-time">{formatTime(currentTime)}</span>
          <div className="v3-prog-track v3-prog-seekable" onClick={handleTrackClick}>
            <div className="v3-prog-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="v3-bb-time">{formatTime(totalTime)}</span>
        </div>

        {/* Row 2: Controls */}
        <div className="v3-bb-controls-row">
          <button className="v3-nb" onClick={onPrev} disabled={currentIndex <= 0} title="Previous">
            ◀
          </button>
          <button className="v3-pb" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button className="v3-nb" onClick={onNext} disabled={currentIndex >= sections.length - 1} title="Next">
            ▶
          </button>
          <button className="v3-nb" onClick={onToggleVolume} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            className={`v3-nb${subtitleMode === 'off' ? '' : ' v3-nb--active'}`}
            onClick={onSubtitleToggle}
            title={`Subtitles: ${subtitleMode}`}
            style={{ fontSize: 11, fontWeight: 700, opacity: subtitleMode === 'off' ? 0.4 : 1 }}
          >
            CC
          </button>

          <div className="v3-bb-right-group">
            <div className="v3-bb-sections-wrap">
              <button className="v3-nb" onClick={() => setShowSections(!showSections)} title="Sections">
                ☰
              </button>
              {showSections && (
                <V3SectionsPanel
                  sections={sections}
                  currentIndex={currentIndex}
                  onSectionClick={onSectionClick}
                  onClose={() => setShowSections(false)}
                />
              )}
            </div>
            <button className="v3-nb" onClick={cycleSpeed} title={`Speed: ${playbackRate}×`}>
              {playbackRate}×
            </button>
            <button className="v3-nb" onClick={onToggleFullscreen} title="Fullscreen">
              ⛶
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: single-row layout
  return (
    <div className="v3-botbar">
      <div className="v3-bb-left">
        <button className="v3-nb" onClick={onPrev} disabled={currentIndex <= 0} title="Previous">
          ◀
        </button>
        <button className="v3-pb" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button className="v3-nb" onClick={onNext} disabled={currentIndex >= sections.length - 1} title="Next">
          ▶
        </button>
        <button className="v3-nb" onClick={onToggleVolume} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="v3-bb-center">
        <span className="v3-bb-time">{formatTime(currentTime)}</span>
        <div className="v3-prog-track v3-prog-seekable" onClick={handleTrackClick}>
          <div className="v3-prog-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="v3-bb-time">{formatTime(totalTime)}</span>
      </div>

      <div className="v3-bb-right">
        <div className="v3-bb-sections-wrap">
          <button className="v3-nb" onClick={() => setShowSections(!showSections)} title="Sections">
            ☰
          </button>
          {showSections && (
            <V3SectionsPanel
              sections={sections}
              currentIndex={currentIndex}
              onSectionClick={onSectionClick}
              onClose={() => setShowSections(false)}
            />
          )}
        </div>
        <button
          className={`v3-nb${subtitleMode === 'off' ? '' : ' v3-nb--active'}`}
          onClick={onSubtitleToggle}
          title={`Subtitles: ${subtitleMode}`}
          style={{ fontSize: 11, fontWeight: 700, opacity: subtitleMode === 'off' ? 0.4 : 1 }}
        >
          CC
        </button>
        <button className="v3-nb" onClick={cycleSpeed} title={`Speed: ${playbackRate}×`}>
          {playbackRate}×
        </button>
        <button className="v3-nb" onClick={onToggleFullscreen} title="Fullscreen">
          ⛶
        </button>
      </div>
    </div>
  );
};
