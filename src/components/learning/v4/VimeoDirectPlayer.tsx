import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import { useVideoCompletionTracker } from '@/hooks/useVideoCompletionTracker';
import { V4CompletionDialog } from './V4CompletionDialog';
import { ChapterTestReadyDialog } from '@/components/learning/ChapterTestReadyDialog';
import { V4Notes } from './V4Notes';
import type { V4Presentation } from './types';
import './v4-player.css';

interface Props {
  presentation: V4Presentation;
  jobId: string;
  videoUrl: string;
  onClose: () => void;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  topicTitle?: string;
  language: string;
  availableLanguages: string[];
  onLanguageChange: (next: string) => void;
  restrictToLanguage?: string | null;
}

/**
 * Unbranded direct-Vimeo player for Chapter 1 topics.
 * Plays the progressive mp4 URL from Vimeo inside a plain <video> element with
 * native controls — no Vimeo iframe, no logo, no share/like buttons.
 * Keeps V4 completion tracking, language switcher, and close button.
 */
export const VimeoDirectPlayer = ({
  presentation,
  jobId,
  videoUrl,
  onClose,
  topicId,
  chapterId,
  subjectId,
  courseId,
  topicTitle,
  language,
  availableLanguages,
  onLanguageChange,
  restrictToLanguage,
}: Props) => {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const title =
    topicTitle ||
    presentation.presentation_title ||
    presentation.title ||
    presentation.sections?.[0]?.title ||
    'Lesson';

  const {
    showCompletionDialog,
    dismissDialog,
    reportWatchTime,
    chapterTestReady,
    dismissChapterTestDialog,
  } = useVideoCompletionTracker({
    sections: presentation.sections,
    videoTitle: topicTitle || 'AI Lecture',
    topicId,
    chapterId,
    subjectId,
    courseId,
  });

  // watch-time delta reporting
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const delta = v.currentTime - lastTimeRef.current;
      if (delta > 0 && delta < 5) reportWatchTime(delta);
      lastTimeRef.current = v.currentTime;
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [reportWatchTime, videoUrl]);

  // Reset play position tracking whenever the source (language) changes
  useEffect(() => {
    lastTimeRef.current = 0;
  }, [videoUrl]);

  const handleToggleFullscreen = useCallback(async () => {
    if (!wrapRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current.requestFullscreen();
    } catch (err) {
      console.warn('[VimeoDirectPlayer] fullscreen toggle failed', err);
    }
  }, []);

  useEffect(() => {
    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFS);
    return () => document.removeEventListener('fullscreenchange', onFS);
  }, []);

  const restrictedMissing =
    !!restrictToLanguage &&
    !availableLanguages.includes(restrictToLanguage.toLowerCase());

  return (
    <div
      ref={wrapRef}
      className={`v4-player${isMobile ? ' v4-player--mobile' : ''}${isFullscreen ? ' v4-player--fullscreen' : ''}`}
      style={{ background: '#000' }}
    >
      {/* Minimal top bar: close + title */}
      <div className="v4-topbar" style={{ pointerEvents: 'auto' }}>
        <button className="v4-close-btn" onClick={onClose} title="Close">✕</button>
        <V4Notes
          notesId={jobId}
          subjectId={subjectId}
          chapterId={chapterId}
          topicId={topicId}
        />
        <div className="v4-tb-title">{title}</div>
      </div>

      {/* Language switcher (only if more than one available) */}
      {availableLanguages.length > 1 && (
        <div
          style={{
            position: 'absolute', top: 12, right: 64, zIndex: 50,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            borderRadius: 8, padding: '4px 8px',
          }}
        >
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value.toLowerCase())}
            style={{
              background: 'transparent', color: 'white', border: 'none',
              fontSize: 13, outline: 'none', cursor: 'pointer',
            }}
          >
            {availableLanguages.map((l) => (
              <option key={l} value={l} style={{ color: 'black' }}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {restrictedMissing && (
        <div
          style={{
            position: 'absolute', top: 60, right: 12, zIndex: 50, maxWidth: 320,
            background: 'rgba(220, 38, 38, 0.9)', color: 'white',
            borderRadius: 8, padding: '8px 12px', fontSize: 12,
          }}
        >
          {restrictToLanguage!.charAt(0).toUpperCase() + restrictToLanguage!.slice(1)} preview is not yet available for this topic. Playing English fallback.
        </div>
      )}

      {/* Native video with controls — no Vimeo iframe → no branding */}
      <div className="v4-main v4-main--fullscreen" style={{ position: 'relative' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          playsInline
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        />
        <button
          onClick={handleToggleFullscreen}
          title="Fullscreen"
          style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 40,
            background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none',
            borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
          }}
        >
          ⛶
        </button>
      </div>

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
