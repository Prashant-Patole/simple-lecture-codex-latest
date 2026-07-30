import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import { V4TopBar } from './V4TopBar';
import { V4BottomBar } from './V4BottomBar';
import { V4Subtitles } from './V4Subtitles';
import { V4CompletionDialog } from './V4CompletionDialog';
import { ChapterTestReadyDialog } from '@/components/learning/ChapterTestReadyDialog';
import { useVideoCompletionTracker } from '@/hooks/useVideoCompletionTracker';
import { getMediaSrc } from './utils';
import type { V4Presentation, V4Section, V4Segment, SubtitleMode } from './types';
import './v4-player.css';

interface Props {
  presentation: V4Presentation;
  jobId: string;
  onClose: () => void;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  topicTitle?: string;
  /** Absolute URL of the merged video (e.g. Vimeo mp4). Preferred when present. */
  mergedUrl?: string;
  /** Relative job asset path fallback, resolved via getMediaSrc. */
  mergedPath?: string;
}

/** Build a single virtual section by concatenating all narration segments with cumulative time offsets. */
function buildVirtualSection(sections: V4Section[]): V4Section {
  let offset = 0;
  const segments: V4Segment[] = [];

  for (const s of sections) {
    const segs = s.narration?.segments || [];
    let sectionMaxEnd = 0;

    for (const seg of segs) {
      const dur = seg.duration_seconds ?? seg.duration ?? 0;
      const rawStart = seg.start_seconds ?? 0;
      const rawEnd = seg.end_seconds ?? rawStart + dur;
      const start = offset + rawStart;
      const end = offset + rawEnd;
      sectionMaxEnd = Math.max(sectionMaxEnd, rawEnd);
      segments.push({ ...seg, start_seconds: start, end_seconds: end, duration_seconds: dur });
    }

    const sectionDur =
      s.narration?.total_duration_seconds ??
      Math.max(sectionMaxEnd, segs.reduce((a, seg) => a + (seg.duration_seconds ?? seg.duration ?? 0), 0));
    offset += sectionDur;
  }

  return {
    section_id: 'merged',
    title: 'Lesson',
    section_type: 'content',
    narration: { segments, total_duration_seconds: offset },
  };
}

export const V4MergedPlayer = ({
  presentation,
  jobId,
  onClose,
  topicId,
  chapterId,
  subjectId,
  courseId,
  topicTitle,
  mergedUrl,
  mergedPath,
}: Props) => {
  const isMobile = useIsMobile();
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefObj = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('karaoke');
  const [showTapToStart, setShowTapToStart] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sections = presentation.sections;
  const virtualSection = useMemo(() => buildVirtualSection(sections), [sections]);

  const title =
    presentation.presentation_title || presentation.title || sections[0]?.title || 'Lesson';

  const videoUrl = useMemo(() => {
    if (mergedUrl) return mergedUrl;
    const path = mergedPath || presentation.final_video_path || '';
    return path ? getMediaSrc(path, jobId) : '';
  }, [mergedUrl, mergedPath, presentation.final_video_path, jobId]);

  const resolveError: string | null = null;

  // Keep ref-object in sync for child components that expect React.RefObject
  useEffect(() => {
    videoRefObj.current = videoRef.current;
  });

  // Completion tracking
  const lastTimeRef = useRef(0);
  const {
    showCompletionDialog,
    dismissDialog,
    reportWatchTime,
    chapterTestReady,
    dismissChapterTestDialog,
  } = useVideoCompletionTracker({
    sections,
    videoTitle: topicTitle || 'AI Lecture',
    topicId,
    chapterId,
    subjectId,
    courseId,
  });

  // Mobile gate
  useEffect(() => {
    if (!videoUrl) return;
    const mob = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mob) setShowTapToStart(true);
    else {
      const v = videoRef.current;
      if (v) v.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [videoUrl]);

  // Time / progress
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration && isFinite(v.duration)) {
        setProgress((v.currentTime / v.duration) * 100);
        setCurrentTime(v.currentTime);
        setTotalTime(v.duration);
        const delta = v.currentTime - lastTimeRef.current;
        if (delta > 0 && delta < 5) reportWatchTime(delta);
        lastTimeRef.current = v.currentTime;
      }
    };
    const onEnded = () => setIsPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [reportWatchTime]);

  const handleTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      v.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSpeedChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, []);

  const handleSeek = useCallback((percent: number) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const target = Math.max(0, Math.min(v.duration - 0.05, percent * v.duration));
    v.currentTime = target;
    setCurrentTime(target);
    setProgress((target / v.duration) * 100);
    lastTimeRef.current = target;
  }, []);

  const handleToggleVolume = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = !v.muted;
      setIsMuted(v.muted);
    }
  }, []);

  const handleReplay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerRef.current.requestFullscreen();
    } catch (err) {
      console.warn('[V4MergedPlayer] fullscreen toggle failed', err);
    }
  }, []);

  useEffect(() => {
    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFS);
    return () => document.removeEventListener('fullscreenchange', onFS);
  }, []);

  const handleTapToStart = useCallback(() => {
    setShowTapToStart(false);
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  return (
    <div
      className={`v4-player${isMobile ? ' v4-player--mobile' : ''}${isFullscreen ? ' v4-player--fullscreen' : ''}`}
      ref={playerRef}
    >
      {showTapToStart && (
        <div className="v4-tap-to-start" onClick={handleTapToStart}>
          <div style={{ fontSize: 48 }}>▶️</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Tap to start lesson</div>
          <div style={{ fontSize: 13, color: 'rgba(230,237,243,0.5)' }}>Audio required</div>
        </div>
      )}

      <V4TopBar
        title={title}
        sections={sections}
        currentIndex={0}
        onSectionClick={() => {}}
        onClose={onClose}
        isMobile={isMobile}
        hideDots
        hideSectionName
        notesId={jobId}
        subjectId={subjectId}
        chapterId={chapterId}
        topicId={topicId}
      />

      <div className="v4-main v4-main--fullscreen">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="v4-merged-video"
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6edf3', background: '#000' }}>
            {resolveError ? 'Loading fallback…' : 'Resolving video…'}
          </div>
        )}
      </div>

      <V4Subtitles section={virtualSection} avatarVideoRef={videoRefObj} mode={subtitleMode} />

      <V4BottomBar
        sections={sections}
        currentIndex={0}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        progress={progress}
        currentTime={currentTime}
        totalTime={totalTime}
        isMuted={isMuted}
        subtitleMode={subtitleMode}
        isMobile={isMobile}
        alwaysEnableNav
        onPrev={() => {
          const v = videoRef.current;
          if (!v) return;
          v.currentTime = Math.max(0, v.currentTime - 10);
        }}
        onNext={() => {
          const v = videoRef.current;
          if (!v) return;
          const dur = isFinite(v.duration) ? v.duration : v.currentTime + 10;
          v.currentTime = Math.min(dur - 0.05, v.currentTime + 10);
        }}
        onReplay={handleReplay}
        onTogglePlay={handleTogglePlay}
        onSpeedChange={handleSpeedChange}
        onSeek={handleSeek}
        onToggleVolume={handleToggleVolume}
        onToggleFullscreen={handleToggleFullscreen}
        onSectionClick={() => {}}
        onSubtitleToggle={() => {
          setSubtitleMode((m) => (m === 'karaoke' ? 'full' : m === 'full' ? 'off' : 'karaoke'));
        }}
      />

      <V4CompletionDialog show={showCompletionDialog} onDismiss={dismissDialog} topicTitle={topicTitle} />

      {chapterTestReady && (
        <ChapterTestReadyDialog
          open={!!chapterTestReady}
          onLater={dismissChapterTestDialog}
          selfTestId={chapterTestReady.selfTestId}
          chapterTitle={chapterTestReady.chapterTitle}
        />
      )}
    </div>
  );
};
