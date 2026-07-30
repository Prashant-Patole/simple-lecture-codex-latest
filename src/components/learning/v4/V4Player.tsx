import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { V4TopBar } from './V4TopBar';
import { V4BottomBar } from './V4BottomBar';
import { V4Avatar, type V4AvatarHandle } from './V4Avatar';
import { V4ContentLayers } from './V4ContentLayers';
import { V4Subtitles } from './V4Subtitles';
import { V4IntroScene } from './sections/V4IntroScene';
import { V4SummaryScene } from './sections/V4SummaryScene';
import { V4MemoryScene } from './sections/V4MemoryScene';
import { V4RecapScene } from './sections/V4RecapScene';
import { V4QuizScene } from './sections/V4QuizScene';
import { useMediaPreloader } from './hooks/useMediaPreloader';
import { V4_PROXY_BASE } from './constants';
import { getSectionType, isMergedSection, getPrimarySectionAssets, logV4SectionEnter, logV4SectionExit, getMediaSrc, getMergedVideoForLanguage } from './utils';
import type { V4Presentation, V4Section, SubtitleMode, V4ExplanationVisual } from './types';
import { V4MergedPlayer } from './V4MergedPlayer';
import { VimeoDirectPlayer } from './VimeoDirectPlayer';
import './v4-player.css';

import { Progress } from '@/components/ui/progress';
import { useVideoCompletionTracker } from '@/hooks/useVideoCompletionTracker';
import { V4CompletionDialog } from './V4CompletionDialog';
import { ChapterTestReadyDialog } from '@/components/learning/ChapterTestReadyDialog';

interface V4PlayerProps {
  jobId: string;
  onClose: () => void;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  topicTitle?: string;
  initialLanguage?: string | null;
  /** When set, lock the player to this language and disable the language switcher. */
  restrictToLanguage?: string | null;
}

// Trial: jobs where non-English playback must be handed off to the V3 trial
// player (video-beats-only), because V4's multi-language pipeline is not wired
// up for these marketing jobs yet.
// NOTE: SocialScience_20260630115302591_5462fd6a (Social Science 1.3) is
// intentionally NOT listed — it is routed to V4 via V3PlayerDialog's
// V4_JOB_LANG_OVERRIDES so the merged Kannada mp4 plays as a single video.
const V3_TRIAL_JOB_IDS = new Set<string>([]);
const redirectToV3Trial = (jid: string, lang: string) => {
  window.location.assign(`/v3-trial?job=${encodeURIComponent(jid)}&lang=${encodeURIComponent(lang)}`);
};

export const V4Player = ({ jobId, onClose, topicId, chapterId, subjectId, courseId, topicTitle, initialLanguage, restrictToLanguage }: V4PlayerProps) => {
  const [presentation, setPresentation] = useState<V4Presentation | null>(null);
  const [sections, setSections] = useState<V4Section[]>([]);
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
  const [explanationVisual, setExplanationVisual] = useState<V4ExplanationVisual | null>(null);
  const [subtitlesKilled, setSubtitlesKilled] = useState(false);
  const mediaWorkerReady = true;
  const setMediaWorkerReady = (_: boolean) => {};
  void setMediaWorkerReady;
  const [language, setLanguage] = useState<string>(() => {
    if (initialLanguage) return initialLanguage.toLowerCase();
    if (typeof window === 'undefined') return 'english';
    return (new URLSearchParams(window.location.search).get('lang') || 'english').toLowerCase();
  });

  // Trial handoff: if this job is trial-listed and a non-English language was
  // requested via prop/URL, bounce to the V3 trial player immediately.
  useEffect(() => {
    if (V3_TRIAL_JOB_IDS.has(jobId) && language && language !== 'english') {
      redirectToV3Trial(jobId, language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Note: `restrictToLanguage` is only used as the *initial* language (via
  // `initialLanguage` in the state initializer above). The dropdown remains
  // fully switchable — free-preview visitors can select English or any other
  // available language after the player opens.
  const avatarRef = useRef<V4AvatarHandle>(null);
  const needsAutoStart = useRef(false);
  const previousLanguageRef = useRef(language);
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const computePortrait = () => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia('(orientation: portrait)').matches) return true;
      if (window.matchMedia('(orientation: landscape)').matches) return false;
    } catch (err) {
      console.debug('[V4Player] orientation media query unavailable', err);
    }
    return window.innerHeight >= window.innerWidth;
  };
  const [isPortrait, setIsPortrait] = useState(computePortrait);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setMediaWorkerReady(true);
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .register('/v4-media-sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (!cancelled) {
          console.log('[V4MediaSW] ready');
          setMediaWorkerReady(true);
        }
      })
      .catch((err) => {
        console.warn('[V4MediaSW] unavailable, falling back to direct media path', err);
        if (!cancelled) setMediaWorkerReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Merged-mode: single composited video for the whole presentation (per-language aware)
  const mergedForLang = getMergedVideoForLanguage(presentation, language);
  const mergedMode = !!(mergedForLang.url || mergedForLang.path);

  // Media preloader (skip work in merged mode)
  const { getBlob, initialReady, cacheProgress, preloadNext } = useMediaPreloader(mergedMode ? [] : sections, currentIndex, jobId, language);

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
    const url = `${V4_PROXY_BASE}/player/jobs/${jobId}/presentation.json?t=${Date.now()}`;
    console.log('[V4Player] Fetching presentation:', url);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((data: V4Presentation) => {
        if (!data.sections || data.sections.length === 0) {
          throw new Error('presentation.json has no sections');
        }
        console.log('[V4Player] Loaded', data.sections.length, 'sections');
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
        console.error('[V4Player] Error:', err);
        setError(err.message || 'Failed to load presentation');
        setLoading(false);
      });
  }, [jobId]);

  // Tracks the previous section so we can emit an EXIT log when it changes
  const prevSectionRef = useRef<{ index: number; primaryFromBlob: boolean } | null>(null);

  const loadSection = useCallback((index: number, secs?: V4Section[]) => {
    const s = secs || sections;
    if (index < 0 || index >= s.length) return;

    const sec = s[index];
    const secType = getSectionType(sec);
    void secType;

    // EXIT log for previous section (close group)
    if (prevSectionRef.current && prevSectionRef.current.index !== index) {
      logV4SectionExit({
        sectionIndex: prevSectionRef.current.index,
        playedFromBlob: prevSectionRef.current.primaryFromBlob,
      });
      try { console.groupEnd(); } catch (err) { console.debug('[V4Player] console.groupEnd failed', err); }
    }

    // ENTER log for new section — resolve primary asset and check blob cache
    const assets = getPrimarySectionAssets(sec, index, jobId, language);
    const primary = assets[0];
    const blobHit = primary ? !!getBlob(primary.url) : false;
    try {
      console.group(`▼ === SECTION ${index} ENTER === source=${primary ? (blobHit ? 'BLOB' : 'PROXY') : 'NONE'} primaryKind=${primary ? primary.kind : 'none'} "${(sec.title || '').slice(0,40)}"`);
    } catch (err) {
      console.debug('[V4Player] console.group failed', err);
    }
    logV4SectionEnter({
      sectionIndex: index,
      title: sec.title,
      primaryKind: primary ? primary.kind : 'none',
      source: primary ? (blobHit ? 'BLOB' : 'PROXY') : 'NONE',
    });
    prevSectionRef.current = { index, primaryFromBlob: blobHit };

    setCurrentIndex(index);
    setProgress(0);
    setIsPlaying(true);
    setShowQuiz(false);
    setExplanationVisual(null);
    setSubtitlesKilled(false);

    if (avatarRef.current) {
      avatarRef.current.loadAvatar(s[index], jobId, playbackRate, getBlob, index, language);
    } else {
      console.warn('[V4Player] avatarRef is null — avatar will not load for section', index);
    }
  }, [sections, jobId, playbackRate, getBlob, language]);


  // Heartbeat: every 8s, log current section + cache status
  useEffect(() => {
    if (loading || sections.length === 0) return;
    const id = window.setInterval(() => {
      const sec = sections[currentIndex];
      if (!sec) return;
      const assets = getPrimarySectionAssets(sec, currentIndex, jobId, language);
      const primary = assets[0];
      const blobHit = primary ? !!getBlob(primary.url) : false;
      const vid = avatarRef.current?.video;
      const ct = vid ? vid.currentTime.toFixed(1) : '?';
      console.log(`[V4Heartbeat] sec=${currentIndex} kind=${primary?.kind || 'none'} source=${primary ? (blobHit ? 'BLOB' : 'PROXY') : 'NONE'} currentTime=${ct}s`);
    }, 8000);
    return () => clearInterval(id);
  }, [loading, sections, currentIndex, jobId, getBlob, language]);


  // Auto-start first section after avatar has mounted AND initial media is cached
  useEffect(() => {
    if (!loading && sections.length > 0 && needsAutoStart.current && initialReady && mediaWorkerReady) {
      console.log('[V4Player] Auto-starting section 0 (media cached), avatarRef:', !!avatarRef.current);
      needsAutoStart.current = false;
      loadSection(0);
    }
  }, [loading, sections, loadSection, initialReady, mediaWorkerReady]);

  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    if (loading || !initialReady || sections.length === 0) return;
    previousLanguageRef.current = language;
    console.log('[V4Player] Reloading current section for language:', language);
    loadSection(currentIndex);
  }, [language, loading, initialReady, sections.length, currentIndex, loadSection]);

  // Progress tracking via avatar video element
  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatar?.video) {
      console.log('[V4Player] Progress effect: avatarRef.video is null — listeners NOT attached (will re-run when isPlaying changes)');
      return;
    }
    const vid = avatar.video;
    console.log(`[V4Player] Progress effect: attaching timeupdate+ended listeners for section ${currentIndex}`);

    let lastTimeupdateLog = 0;
    const onTimeUpdate = () => {
      if (vid.duration && isFinite(vid.duration)) {
        setProgress((vid.currentTime / vid.duration) * 100);
        setCurrentTime(vid.currentTime);
        setTotalTime(vid.duration);

        // Report watch time delta for completion tracking
        const delta = vid.currentTime - lastTimeRef.current;
        if (delta > 0 && delta < 5) {
          const now = Date.now();
          if (now - lastTimeupdateLog >= 5000) {
            lastTimeupdateLog = now;
            console.log(`[V4Player] timeupdate currentTime=${vid.currentTime.toFixed(1)}s (throttled 5s)`);
          }
          reportWatchTime(delta);
        }
        lastTimeRef.current = vid.currentTime;
      }
    };

    const onEnded = () => {
      const sec = sections[currentIndex];
      const secType = getSectionType(sec);
      console.log(`[V4Player] onEnded section=${currentIndex} type="${secType}" showQuiz=${showQuiz} hasNext=${currentIndex < sections.length - 1}`);

      // Check if content section has embedded quiz FIRST
      const hasEmbeddedQuiz = secType !== 'quiz' && (
        (sec.questions && sec.questions.length > 0) || sec.understanding_quiz
      );

      if (hasEmbeddedQuiz) {
        console.log('[V4Player] Showing embedded quiz for content section', currentIndex);
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
  }, [currentIndex, sections, loadSection, isPlaying, showQuiz, reportWatchTime]);

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
    console.log(`[V4Player] handlePrev from=${currentIndex} to=${currentIndex - 1}`);
    if (currentIndex > 0) loadSection(currentIndex - 1);
  }, [currentIndex, loadSection]);

  const handleNext = useCallback(() => {
    console.log(`[V4Player] handleNext from=${currentIndex} to=${currentIndex + 1}`);
    if (currentIndex < sections.length - 1) loadSection(currentIndex + 1);
  }, [currentIndex, sections.length, loadSection]);

  const handleTapToStart = useCallback(() => {
    if (!mediaWorkerReady) return;
    setShowTapToStart(false);
    loadSection(0);
  }, [loadSection, mediaWorkerReady]);

  const handleSeek = useCallback((percent: number) => {
    const vid = avatarRef.current?.video;
    if (!vid) {
      console.warn('[V4Player] handleSeek: no video ref');
      return;
    }
    const duration = vid.duration;
    if (!isFinite(duration) || duration <= 0) {
      console.warn('[V4Player] handleSeek: duration not ready', duration);
      return;
    }
    const clamped = Math.max(0, Math.min(1, percent));
    let target = clamped * duration;
    // Clamp into seekable range if available
    let seekableEnd = duration;
    try {
      if (vid.seekable && vid.seekable.length > 0) {
        seekableEnd = vid.seekable.end(vid.seekable.length - 1);
        if (target > seekableEnd) target = Math.max(0, seekableEnd - 0.05);
      }
    } catch (err) {
      console.debug('[V4Player] seekable read failed', err);
    }
    target = Math.max(0, Math.min(duration - 0.05, target));
    console.log('[V4Player] handleSeek', { percent: clamped, target, duration, seekableEnd });
    const wasPlaying = !vid.paused;
    try {
      vid.pause();
      const anyVid = vid as HTMLVideoElement & { fastSeek?: (t: number) => void };
      if (typeof anyVid.fastSeek === 'function') {
        try { anyVid.fastSeek(target); } catch { vid.currentTime = target; }
      } else {
        vid.currentTime = target;
      }
      if (wasPlaying || isPlaying) {
        vid.play().catch(() => {});
      }
    } catch (err) {
      console.warn('[V4Player] seek failed', err);
    }
    // Optimistic UI update
    setCurrentTime(target);
    setProgress((target / duration) * 100);
    lastTimeRef.current = target;
  }, [isPlaying]);

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
          try { screen.orientation.unlock(); } catch (err) { console.debug('[V4Player] orientation unlock failed', err); }
        }
      } else {
        await playerRef.current.requestFullscreen();
        if (isMobile && screen.orientation) {
          try { await screen.orientation.lock('landscape'); } catch (err) { console.debug('[V4Player] orientation lock failed', err); }
        }
      }
    } catch (err) {
      console.warn('[V4Player] fullscreen toggle failed', err);
    }
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
  const getAvatarVideo = useCallback(() => avatarRef.current?.video || null, []);

  // Kick off next-section preload the moment the current section actually starts
  // playing. Deferring this (instead of firing at initialReady) keeps the Kannada
  // avatar download from competing with section 1's asset bundle over the same pipe.
  useEffect(() => {
    if (!initialReady) return;
    const vid = getAvatarVideo();
    if (!vid) return;
    let fired = false;
    const onPlaying = () => {
      if (fired) return;
      fired = true;
      preloadNext(currentIndex);
    };
    if (!vid.paused && vid.readyState >= 2) onPlaying();
    vid.addEventListener('playing', onPlaying);
    return () => vid.removeEventListener('playing', onPlaying);
  }, [initialReady, currentIndex, preloadNext, getAvatarVideo]);


  // Strict logging for memory_infographic ("Visual Concept Summary") sections.
  useEffect(() => {
    if (!currentSection) return;
    if (getSectionType(currentSection) !== 'memory_infographic') return;
    const beats = currentSection.render_spec?.infographic_beats?.length ?? 0;
    const totalDur = currentSection.narration?.total_duration_seconds ?? 0;
    const merged = isMergedSection(currentSection, language);
    console.log(`[V4Infographic] ENTER sec=${currentIndex} beats=${beats} totalDur=${totalDur} merged=${merged} title="${currentSection.title ?? ''}"`);
    return () => {
      console.log(`[V4Infographic] EXIT sec=${currentIndex}`);
    };
  }, [currentSection, currentIndex]);

  // Strict logging for recap ("Lesson Recap") sections — confirm merged final video is used.
  useEffect(() => {
    if (!currentSection) return;
    if (getSectionType(currentSection) !== 'recap') return;
    const merged = isMergedSection(currentSection, language);
    const finalPath = (currentSection as any).final_video_path || '';
    const avatarPath = (currentSection as any).avatar_video || (currentSection as any).avatar_url || (currentSection as any).avatar || '';
    console.log(`[V4Recap] ENTER sec=${currentIndex} merged=${merged} finalPath=${finalPath.slice(-60)} avatarPath=${avatarPath.slice(-60)} title="${currentSection.title ?? ''}"`);
    return () => {
      console.log(`[V4Recap] EXIT sec=${currentIndex}`);
    };
  }, [currentSection, currentIndex]);

  // Render scene content based on section type
  const renderScene = () => {
    if (!currentSection) return null;
    // Merged-mode sections are a single composited video — skip text/visual overlays.
    if (isMergedSection(currentSection, language)) return null;

    switch (sectionType) {
      case 'intro':
        return <V4IntroScene section={currentSection} />;
      case 'summary':
        return <V4SummaryScene section={currentSection} avatarVideoRef={avatarVideoRef} />;
      case 'memory':
        return <V4MemoryScene section={currentSection} getAvatarVideo={getAvatarVideo} />;
      case 'recap':
        return <V4RecapScene section={currentSection} avatarVideoRef={avatarVideoRef} />;
      case 'memory_infographic':
        // Merged final video carries the infographic visuals; no overlay needed.
        return null;
      default:
        return null;
    }
  };

  // Merged-mode short-circuit: play single composited video with karaoke subtitles only.
  if (presentation && mergedMode) {
    // Chapter 1 topics: if we have a direct Vimeo mp4 URL, play it unbranded
    // in a plain <video> element (no V4 chrome, no subtitles). Falls back to
    // V4MergedPlayer when only a job-folder path is available.
    const isVimeoUrl = !!mergedForLang.url && /(^|\.)vimeo\.com\//i.test(mergedForLang.url);
    if (isVimeoUrl) {
      return (
        <VimeoDirectPlayer
          presentation={presentation}
          jobId={jobId}
          videoUrl={mergedForLang.url}
          onClose={onClose}
          topicId={topicId}
          chapterId={chapterId}
          subjectId={subjectId}
          courseId={courseId}
          topicTitle={topicTitle}
          language={language}
          availableLanguages={availableLanguages}
          onLanguageChange={(next) => {
            if (next !== 'english' && V3_TRIAL_JOB_IDS.has(jobId)) {
              redirectToV3Trial(jobId, next);
              return;
            }
            setLanguage(next);
          }}
          restrictToLanguage={restrictToLanguage}
        />
      );
    }
    return (
      <V4MergedPlayer
        presentation={presentation}
        jobId={jobId}
        onClose={onClose}
        topicId={topicId}
        chapterId={chapterId}
        subjectId={subjectId}
        courseId={courseId}
        topicTitle={topicTitle}
        mergedUrl={mergedForLang.url}
        mergedPath={mergedForLang.path}
      />
    );
  }

  if (loading || !initialReady) {

    const pct = cacheProgress.total > 0
      ? Math.round((cacheProgress.loaded / cacheProgress.total) * 100)
      : 0;
    return (
      <div className="v4-player">
        <div className="v4-loading-screen">
          <div className="v4-loading-spinner" />
          <div className="v4-loading-text">
            {loading ? 'Loading lesson...' : `Preparing lecture... ${cacheProgress.loaded}/${cacheProgress.total}`}
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
      <div className="v4-player">
        <div className="v4-error-screen">
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 14, color: 'var(--v4-rose)', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            {error}
          </div>
          <button className="v4-nb" onClick={onClose} style={{ marginTop: 12, padding: '8px 20px', width: 'auto' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`v4-player${isMobile ? ' v4-player--mobile' : ''}${isMobile && isPortrait ? ' v4-player--portrait' : ''}${isMobile && !isPortrait ? ' v4-player--landscape' : ''}${isFullscreen ? ' v4-player--fullscreen' : ''}`} ref={playerRef}>
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
        currentIndex={currentIndex}
        onSectionClick={(i) => loadSection(i)}
        onClose={onClose}
        isMobile={isMobile}
        notesId={jobId}
        subjectId={subjectId}
        chapterId={chapterId}
        topicId={topicId}
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
              if (next !== 'english' && V3_TRIAL_JOB_IDS.has(jobId)) {
                redirectToV3Trial(jobId, next);
                return;
              }
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

      {restrictToLanguage && sections.length > 0 && !availableLanguages.includes(restrictToLanguage.toLowerCase()) && (
        <div
          style={{
            position: 'absolute', top: 60, right: 12, zIndex: 50, maxWidth: 320,
            background: 'rgba(220, 38, 38, 0.9)', color: 'white',
            borderRadius: 8, padding: '8px 12px', fontSize: 12,
          }}
        >
          {restrictToLanguage.charAt(0).toUpperCase() + restrictToLanguage.slice(1)} preview is not yet available for this topic. Playing English fallback.
        </div>
      )}


      <div className={`v4-main ${sectionType === 'intro' ? 'v4-main--fullscreen' : ''}${(sectionType === 'quiz' || showQuiz) && !explanationVisual ? ' v4-main--quiz' : ''}${explanationVisual ? ' v4-main--explanation' : ''}`}>
        <V4ContentLayers
          section={(sectionType === 'quiz' || showQuiz || (currentSection && isMergedSection(currentSection, language))) ? null : (currentSection || null)}
          jobId={jobId}
          avatarVideoRef={avatarVideoRef}
          getBlob={getBlob}
          sectionIndex={currentIndex}
        />

        {/* Scene overlay — only current section rendered */}
        <div className={`v4-scene on${sectionType === 'memory' ? ' v4-scene--left' : ''}`}>
          {renderScene()}
        </div>

        {/* Quiz overlay — now inside stage for correct positioning context */}
        {(sectionType === 'quiz' || showQuiz) && currentSection && (
          <V4QuizScene
            section={currentSection}
            jobId={jobId}
            avatarRef={avatarRef}
            playbackRate={playbackRate}
            getBlob={getBlob}
            sectionIndex={currentIndex}
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
              console.log('[V4Player] Showing explanation visual', visual);
              setExplanationVisual(visual);
            }}
            onHideExplanationVisual={() => {
              console.log('[V4Player] Hiding explanation visual');
              setExplanationVisual(null);
            }}
          />
        )}

        {/* Explanation visual overlay (left 50%) — pairs with avatar on right 50% */}
        {explanationVisual && (() => {
          const path = explanationVisual.video_path || explanationVisual.wan_video_path;
          const img = explanationVisual.image_path || explanationVisual.image_source;
          const src = path ? (getBlob?.(getMediaSrc(path, jobId)) || getMediaSrc(path, jobId)) : null;
          const imgSrc = img ? (getBlob?.(getMediaSrc(img, jobId)) || getMediaSrc(img, jobId)) : null;
          return (
            <div className="v4-explanation-visual-overlay">
              {src ? (
                <video src={src} autoPlay muted={false} playsInline loop />
              ) : imgSrc ? (
                <img src={imgSrc} alt="explanation visual" />
              ) : null}
            </div>
          );
        })()}

        {/* Avatar with WebGL chroma key — inside stage for portrait positioning */}
        <V4Avatar
          ref={avatarRef}
          jobId={jobId}
          sectionType={showQuiz ? 'quiz' : sectionType}
          visible={sections.length > 0}
        />
      </div>

      {/* Karaoke subtitles — killed during quiz */}
      {!subtitlesKilled && (
        <V4Subtitles
          section={currentSection || null}
          avatarVideoRef={avatarVideoRef}
          mode={subtitleMode}
        />
      )}

      <V4BottomBar
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

      <V4CompletionDialog
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
