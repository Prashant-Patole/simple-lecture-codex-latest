import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { V3TopBar } from './V3TopBar';
import { V3BottomBar } from './V3BottomBar';
import { V3Avatar, type V3AvatarHandle } from './V3Avatar';
import { V3ContentLayers } from './V3ContentLayers';
import { V3Subtitles } from './V3Subtitles';
import { V3IntroScene } from './sections/V3IntroScene';
import { V3SummaryScene } from './sections/V3SummaryScene';
import { V3MemoryScene } from './sections/V3MemoryScene';
import { V3RecapScene } from './sections/V3RecapScene';
import { V3QuizScene } from './sections/V3QuizScene';
import { useMediaPreloader } from './hooks/useMediaPreloader';
import { useV3PlaybackGate } from './hooks/useV3PlaybackGate';
import { V3_PROXY_BASE } from './constants';
import { filterToVideoBeats } from './utils/filterVideoBeats';
import { getSectionType } from './utils';
import type { V3Presentation, V3Section, SubtitleMode, V3ExplanationVisual } from './types';
import './v3-player.css';
import { Progress } from '@/components/ui/progress';
import { useVideoCompletionTracker } from '@/hooks/useVideoCompletionTracker';
import { V3CompletionDialog } from './V3CompletionDialog';
import { ChapterTestReadyDialog } from '@/components/learning/ChapterTestReadyDialog';

interface V3PlayerProps {
  jobId: string;
  onClose: () => void;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  topicTitle?: string;
  initialLanguage?: string | null;
  /** Trial: keep only Manim/video visual_beats and stretch to narration length. */
  videoBeatsOnly?: boolean;
}

export const V3Player = ({ jobId, onClose, topicId, chapterId, subjectId, courseId, topicTitle, initialLanguage, videoBeatsOnly }: V3PlayerProps) => {
  const [presentation, setPresentation] = useState<V3Presentation | null>(null);
  const [sections, setSections] = useState<V3Section[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('karaoke');
  const [showTapToStart, setShowTapToStart] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [explanationVisual, setExplanationVisual] = useState<V3ExplanationVisual | null>(null);
  const [subtitlesKilled, setSubtitlesKilled] = useState(false);
  // Language: initialised from ?lang= URL param (default "english")
  const [language, setLanguage] = useState<string>(() => {
    if (initialLanguage) return initialLanguage.toLowerCase();
    if (typeof window === 'undefined') return 'english';
    const p = new URLSearchParams(window.location.search).get('lang');
    return (p || 'english').toLowerCase();
  });
  const avatarRef = useRef<V3AvatarHandle>(null);
  const needsAutoStart = useRef(false);
  const previousLanguageRef = useRef(language);
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const computePortrait = () => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia('(orientation: portrait)').matches) return true;
      if (window.matchMedia('(orientation: landscape)').matches) return false;
    } catch {}
    return window.innerHeight >= window.innerWidth;
  };
  const [isPortrait, setIsPortrait] = useState(computePortrait);

  // Media preloader (language-aware)
  const { getBlob, initialReady, cacheProgress } = useMediaPreloader(sections, currentIndex, jobId, language);

  // Non-English playback sync gate — English is intentionally a no-op.
  const [layerVideos, setLayerVideos] = useState<{ wan: HTMLVideoElement | null; manim: HTMLVideoElement | null }>({ wan: null, manim: null });
  const onLayerVideosMount = useCallback((els: { wan: HTMLVideoElement | null; manim: HTMLVideoElement | null }) => {
    setLayerVideos(els);
  }, []);
  const { buffering: syncBuffering } = useV3PlaybackGate({
    avatarEl: avatarRef.current?.video || null,
    wanEl: layerVideos.wan,
    manimEl: layerVideos.manim,
    language,
    enabled: language.toLowerCase() !== 'english',
    sectionKey: currentIndex,
  });

  // Available languages across all sections (english is always first)
  const availableLanguages = (() => {
    const set = new Set<string>(['english']);
    for (const s of sections) {
      for (const a of s.avatar_languages || []) {
        const l = (a?.language || '').toLowerCase();
        const st = (a?.status || '').toLowerCase();
        if (l && ['completed', 'ready', 'success'].includes(st)) set.add(l);
      }
    }
    return Array.from(set);
  })();

  // Completion tracker
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

  // Fetch presentation.json
  useEffect(() => {
    const url = `${V3_PROXY_BASE}/player/jobs/${jobId}/presentation.json?t=${Date.now()}`;
    console.log('[V3Player] Fetching presentation:', url);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((raw: V3Presentation) => {
        const data = videoBeatsOnly ? filterToVideoBeats(raw) : raw;
        if (!data.sections || data.sections.length === 0) {
          throw new Error('presentation.json has no sections');
        }
        console.log('[V3Player] Loaded', data.sections.length, 'sections', videoBeatsOnly ? '(video-beats-only)' : '');
        setPresentation(data);
        setSections(data.sections);
        setLoading(false);

        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          setShowTapToStart(true);
        } else {
          needsAutoStart.current = true;
        }
      })
      .catch((err) => {
        console.error('[V3Player] Error:', err);
        setError(err.message || 'Failed to load presentation');
        setLoading(false);
      });
  }, [jobId]);

  const loadSection = useCallback((index: number, secs?: V3Section[]) => {
    const s = secs || sections;
    if (index < 0 || index >= s.length) return;

    const sec = s[index];
    const secType = getSectionType(sec);
    console.log(`[V3Player] loadSection(${index}) type="${secType}" title="${sec.title || ''}" avatarRef=${!!avatarRef.current}`);

    setCurrentIndex(index);
    setProgress(0);
    setIsPlaying(true);
    setShowQuiz(false);
    setExplanationVisual(null);
    setSubtitlesKilled(false);

    if (avatarRef.current) {
      avatarRef.current.loadAvatar(s[index], jobId, playbackRate, getBlob, language);
    } else {
      console.warn('[V3Player] avatarRef is null — avatar will not load for section', index);
    }
  }, [sections, jobId, playbackRate, getBlob, language]);

  // Non-English watchdog: if preloader hasn't flipped initialReady within 10s
  // (e.g. cold proxy on Kannada avatar), force-start playback anyway. The
  // <video> element can still stream via ranged requests, and useV3PlaybackGate
  // will show "Buffering…" if the network can't keep up. English path is
  // untouched — it continues to wait for full blob prefetch.
  const [watchdogFired, setWatchdogFired] = useState(false);
  useEffect(() => {
    if (loading || initialReady || sections.length === 0) return;
    if ((language || 'english').toLowerCase() === 'english') return;
    const t = window.setTimeout(() => {
      console.warn('[V3Player] Non-English preload watchdog fired (10s) — starting playback with streaming fallback');
      setWatchdogFired(true);
    }, 10000);
    return () => window.clearTimeout(t);
  }, [loading, initialReady, sections.length, language]);

  const readyToStart = initialReady || watchdogFired;

  // Auto-start first section after avatar has mounted AND initial media is cached (or watchdog fired)
  useEffect(() => {
    if (!loading && sections.length > 0 && needsAutoStart.current && readyToStart) {
      console.log('[V3Player] Auto-starting section 0 (readyToStart)', { initialReady, watchdogFired });
      needsAutoStart.current = false;
      loadSection(0);
    }
  }, [loading, sections, loadSection, readyToStart, initialReady, watchdogFired]);

  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    if (loading || !readyToStart || sections.length === 0) return;
    previousLanguageRef.current = language;
    setWatchdogFired(false);
    console.log('[V3Player] Reloading current section for language:', language);
    loadSection(currentIndex);
  }, [language, loading, readyToStart, sections.length, currentIndex, loadSection]);

  // Progress tracking via avatar video element
  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatar?.video) {
      console.log('[V3Player] Progress effect: avatarRef.video is null — listeners NOT attached (will re-run when isPlaying changes)');
      return;
    }
    const vid = avatar.video;
    console.log(`[V3Player] Progress effect: attaching timeupdate+ended listeners for section ${currentIndex}`);

    const onTimeUpdate = () => {
      if (vid.duration && isFinite(vid.duration)) {
        setProgress((vid.currentTime / vid.duration) * 100);
        setCurrentTime(vid.currentTime);
        setTotalTime(vid.duration);

        // Report watch time delta for completion tracking
        const delta = vid.currentTime - lastTimeRef.current;
        if (delta > 0 && delta < 5) {
          console.log(`[V3Player] timeupdate delta=${delta.toFixed(2)}s currentTime=${vid.currentTime.toFixed(1)}s`);
          reportWatchTime(delta);
        }
        lastTimeRef.current = vid.currentTime;
      }
    };

    const onEnded = () => {
      const sec = sections[currentIndex];
      const secType = getSectionType(sec);
      console.log(`[V3Player] onEnded section=${currentIndex} type="${secType}" showQuiz=${showQuiz} hasNext=${currentIndex < sections.length - 1}`);

      // Check if content section has embedded quiz FIRST
      const hasEmbeddedQuiz = secType !== 'quiz' && (
        (sec.questions && sec.questions.length > 0) || sec.understanding_quiz
      );

      if (hasEmbeddedQuiz) {
        console.log('[V3Player] Showing embedded quiz for content section', currentIndex);
        setShowQuiz(true);
        setSubtitlesKilled(true);
        return; // Don't touch isPlaying — quiz will play clips
      }

      // Only pause if not in a quiz context
      if (secType !== 'quiz' && !showQuiz) {
        setIsPlaying(false);
      }

      if (secType !== 'quiz' && currentIndex < sections.length - 1) {
        loadSection(currentIndex + 1);
      }
    };

    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('ended', onEnded);
    return () => {
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, sections, loadSection, isPlaying, showQuiz]);

  const handleTogglePlay = useCallback(() => {
    const vid = avatarRef.current?.video;
    if (!vid) return;
    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      vid.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSpeedChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    const vid = avatarRef.current?.video;
    if (vid) vid.playbackRate = rate;
  }, []);

  const handleReplay = useCallback(() => {
    loadSection(currentIndex);
  }, [currentIndex, loadSection]);

  const handlePrev = useCallback(() => {
    console.log(`[V3Player] handlePrev from=${currentIndex} to=${currentIndex - 1}`);
    if (currentIndex > 0) loadSection(currentIndex - 1);
  }, [currentIndex, loadSection]);

  const handleNext = useCallback(() => {
    console.log(`[V3Player] handleNext from=${currentIndex} to=${currentIndex + 1}`);
    if (currentIndex < sections.length - 1) loadSection(currentIndex + 1);
  }, [currentIndex, sections.length, loadSection]);

  const handleTapToStart = useCallback(() => {
    setShowTapToStart(false);
    loadSection(0);
  }, [loadSection]);

  const handleSeek = useCallback((percent: number) => {
    const vid = avatarRef.current?.video;
    if (!vid || !isFinite(vid.duration)) return;
    const target = percent * vid.duration;
    // Non-English: also nudge content layers to re-buffer so the gate can
    // hold playback until every layer is ready again.
    if (language.toLowerCase() !== 'english') {
      try { layerVideos.wan?.pause(); } catch {}
      try { layerVideos.manim?.pause(); } catch {}
    }
    vid.currentTime = target;
  }, [language, layerVideos]);

  const handleToggleVolume = useCallback(() => {
    const vid = avatarRef.current?.video;
    if (vid) {
      vid.muted = !vid.muted;
      setIsMuted(vid.muted);
    }
  }, []);

  const playerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        if (isMobile && screen.orientation) {
          try { screen.orientation.unlock(); } catch {}
        }
      } else {
        await playerRef.current.requestFullscreen();
        if (isMobile && screen.orientation) {
          try { await (screen.orientation as any).lock('landscape'); } catch {}
        }
      }
    } catch {}
  }, [isMobile]);

  // Track fullscreen state
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // Track orientation — listen to multiple sources & re-check after mount to
  // self-heal WebViews that report wrong values on first paint.
  useEffect(() => {
    const update = () => setIsPortrait(computePortrait());
    update();
    const t = window.setTimeout(update, 100);
    const mqlP = window.matchMedia('(orientation: portrait)');
    const mqlL = window.matchMedia('(orientation: landscape)');
    mqlP.addEventListener?.('change', update);
    mqlL.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.clearTimeout(t);
      mqlP.removeEventListener?.('change', update);
      mqlL.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const title = presentation
    ? presentation.presentation_title || presentation.title || sections[0]?.title || 'Lesson'
    : 'Loading...';

  const currentSection = sections[currentIndex];
  const sectionType = currentSection ? getSectionType(currentSection) : 'content';

  const avatarVideoRef = { current: avatarRef.current?.video || null };

  // Render scene content based on section type
  const renderScene = () => {
    if (!currentSection) return null;

    switch (sectionType) {
      case 'intro':
        return <V3IntroScene section={currentSection} />;
      case 'summary':
        return <V3SummaryScene section={currentSection} avatarVideoRef={avatarVideoRef} />;
      case 'memory':
        return <V3MemoryScene section={currentSection} avatarVideoRef={avatarVideoRef} />;
      case 'recap':
        return <V3RecapScene section={currentSection} avatarVideoRef={avatarVideoRef} />;
      default:
        return null;
    }
  };

  if (loading || !readyToStart) {
    const pct = cacheProgress.total > 0
      ? Math.round((cacheProgress.loaded / cacheProgress.total) * 100)
      : 0;
    const nonEnglish = (language || 'english').toLowerCase() !== 'english';
    return (
      <div className="v3-player">
        <div className="v3-loading-screen">
          <div className="v3-loading-spinner" />
          <div className="v3-loading-text">
            {loading
              ? 'Loading lesson...'
              : nonEnglish
                ? `Preparing ${language}… ${pct}%`
                : `Caching media... ${pct}%`}
          </div>
          {!loading && (
            <div style={{ width: 200, marginTop: 12 }}>
              <Progress value={pct} className="h-2" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="v3-player">
        <div className="v3-error-screen">
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 14, color: 'var(--v3-rose)', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            {error}
          </div>
          <button className="v3-nb" onClick={onClose} style={{ marginTop: 12, padding: '8px 20px', width: 'auto' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`v3-player${isMobile ? ' v3-player--mobile' : ''}${isMobile && isPortrait ? ' v3-player--portrait' : ''}${isMobile && !isPortrait ? ' v3-player--landscape' : ''}${isFullscreen ? ' v3-player--fullscreen' : ''}`} ref={playerRef}>
      {showTapToStart && (
        <div className="v3-tap-to-start" onClick={handleTapToStart}>
          <div style={{ fontSize: 48 }}>▶️</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Tap to start lesson</div>
          <div style={{ fontSize: 13, color: 'rgba(230,237,243,0.5)' }}>Audio required</div>
        </div>
      )}

      <V3TopBar
        title={title}
        sections={sections}
        currentIndex={currentIndex}
        onSectionClick={(i) => loadSection(i)}
        onClose={onClose}
        isMobile={isMobile}
      />

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
            onChange={(e) => {
              const next = e.target.value.toLowerCase();
              setLanguage(next);
            }}
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

      <div className={`v3-main ${sectionType === 'intro' ? 'v3-main--fullscreen' : ''}`}>
        <V3ContentLayers
          section={(sectionType === 'quiz' || showQuiz) ? null : (currentSection || null)}
          jobId={jobId}
          avatarVideoRef={avatarVideoRef}
          getBlob={getBlob}
          onLayerVideosMount={onLayerVideosMount}
        />

        {/* Non-English sync buffering overlay — English V3 never renders this. */}
        {syncBuffering && (
          <div className="v3-sync-buffering">
            <div className="v3-loading-spinner" />
            <div className="v3-sync-buffering__label">Buffering…</div>
          </div>
        )}

        {/* Scene overlay — only current section rendered */}
        <div className="v3-scene on">
          {renderScene()}
        </div>

        {/* Quiz overlay — now inside stage for correct positioning context */}
        {(sectionType === 'quiz' || showQuiz) && currentSection && (
          <V3QuizScene
            section={currentSection}
            jobId={jobId}
            avatarRef={avatarRef}
            playbackRate={playbackRate}
            getBlob={getBlob}
            onPrevSection={handlePrev}
            onNextSection={() => {
              if (showQuiz) {
                setShowQuiz(false);
                setExplanationVisual(null);
                setSubtitlesKilled(false);
                if (currentIndex < sections.length - 1) {
                  loadSection(currentIndex + 1);
                }
              } else {
                handleNext();
              }
            }}
            onShowExplanationVisual={(visual) => {
              console.log('[V3Player] Showing explanation visual', visual);
              setExplanationVisual(visual);
            }}
            onHideExplanationVisual={() => {
              console.log('[V3Player] Hiding explanation visual');
              setExplanationVisual(null);
            }}
          />
        )}

        {/* Avatar with WebGL chroma key — inside stage for portrait positioning */}
        <V3Avatar
          ref={avatarRef}
          jobId={jobId}
          sectionType={sectionType}
          visible={sections.length > 0}
        />
      </div>

      {/* Karaoke subtitles — killed during quiz */}
      {!subtitlesKilled && (
        <V3Subtitles
          section={currentSection || null}
          avatarVideoRef={avatarVideoRef}
          mode={subtitleMode}
        />
      )}

      <V3BottomBar
        sections={sections}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        progress={progress}
        currentTime={currentTime}
        totalTime={totalTime}
        isMuted={isMuted}
        subtitleMode={subtitleMode}
        isMobile={isMobile}
        onPrev={handlePrev}
        onNext={handleNext}
        onReplay={handleReplay}
        onTogglePlay={handleTogglePlay}
        onSpeedChange={handleSpeedChange}
        onSeek={handleSeek}
        onToggleVolume={handleToggleVolume}
        onToggleFullscreen={handleToggleFullscreen}
        onSectionClick={(i) => loadSection(i)}
        onSubtitleToggle={() => {
          setSubtitleMode((m) => m === 'karaoke' ? 'full' : m === 'full' ? 'off' : 'karaoke');
        }}
      />

      <V3CompletionDialog
        show={showCompletionDialog}
        onDismiss={dismissDialog}
        topicTitle={topicTitle}
      />

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
