import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import { PresentationData, PresentationSection } from './types';
import { useVideoCompletionTracker } from '@/hooks/useVideoCompletionTracker';
import { V3CompletionDialog } from '../v3/V3CompletionDialog';
import { ChapterTestReadyDialog } from '@/components/learning/ChapterTestReadyDialog';
import { PlayerControls } from './PlayerControls';
import { SectionPicker } from './SectionPicker';
import { LanguagePicker } from './LanguagePicker';
import { usePlayerState } from './hooks/usePlayerState';
import { useAvailableLanguages } from '@/hooks/useAvailableLanguages';
import { getAdminMediaUrl, getAvatarVideoPath, resolveMediaPath, getVimeoProxyUrl, getChatterboxProxyUrl, getVimeoBeatVideoUrl, getCdnMediaUrl } from './utils/mediaResolver';
import { erodeGreenEdges, smoothAlphaEdges } from './utils/chromaKey';
import { getChromaParams, ChromaKeyParams, DEFAULT_CHROMA_PARAMS, GLChromaParams, getGLChromaParams, GL_DEFAULTS_GREEN, glToCpuParams, type Device } from './utils/chromaKeyPresets';
import { ChromaKeyTuner } from './ChromaKeyTuner';
import { sampleAvatarGreen, autoTuneFromSample } from './utils/sampleAvatarGreen';
import { sampleAvatarGreenSocial, autoTuneFromSocialSample } from './utils/sampleAvatarGreenSocial';
import { V4Notes } from '../v4/V4Notes';

// SSLC Social Science subject — gets its own auto-detect path (bright clean
// green screen → wider matte + feather to eliminate the pixelated rim).
const SSLC_SOCIAL_SUBJECT_ID = 'b4b83f9b-bc1f-433c-9400-234e50ac1b70';
import { useVideoSourceSettings } from '@/hooks/useVideoSourceSettings';
import { Stage, ContentLayer, VideoLayer } from './Stage';
import { 
  IntroSection, 
  SummarySection, 
  ContentSection, 
  MemorySection, 
  RecapSection,
  QuizSection,
} from './sections';
import { cn } from '@/lib/utils';
import { X, Loader2, Play, SkipForward } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

/**
 * True if a Vimeo progressive_redirect signed URL is still valid.
 * These URLs carry ?expires=<unix-seconds>; once past that they return 410 Gone
 * and permanently break avatar playback. Skip them ~60s before expiry to be safe.
 * Non-Vimeo URLs (or URLs without expires) are treated as live.
 */
const isVimeoSignedUrlLive = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    const exp = u.searchParams.get('expires');
    if (!exp) return true;
    const expSec = Number(exp);
    if (!Number.isFinite(expSec)) return true;
    return Date.now() / 1000 < expSec - 60;
  } catch {
    return true;
  }
};



// Helper function for section type badge colors
const getSectionTypeColor = (type: string) => {
  switch (type) {
    case 'intro':
      return 'bg-primary/30 text-primary';
    case 'summary':
      return 'bg-primary/30 text-primary';
    case 'content':
    case 'example':
      return 'bg-green-500/30 text-green-200';
    case 'memory':
      return 'bg-amber-500/30 text-amber-200';
    case 'recap':
      return 'bg-rose-500/30 text-rose-200';
    case 'quiz':
      return 'bg-cyan-500/30 text-cyan-200';
    default:
      return 'bg-white/10 text-gray-200';
  }
};
import './player.css';

import { processChromaKey } from './utils/chromaKey';
import { initChromaKeyGL, ChromaKeyGL } from './utils/chromaKeyGL';
import { chromaLog, describeGL } from './utils/chromaLog';

interface EducationalVideoPlayerProps {
  presentationData: PresentationData;
  jobId: string;
  getMediaUrl?: (jobId: string, path: string) => string;
  onClose?: () => void;
  className?: string;
  initialLanguage?: string | null;
  /** Job-specific server IP - overrides global settings IPs when provided */
  serverIp?: string;
  /** Languages the user has purchased (for filtering LanguagePicker) */
  purchasedLanguages?: string[];
  /** Languages configured by admin as course top-ups */
  courseAvailableLanguages?: string[] | null;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  topicTitle?: string;
  /** Skip the pre-intro video and start the lecture immediately */
  skipPreIntro?: boolean;
  /** Force the player to render with mobile layout regardless of viewport */
  forceMobileLayout?: boolean;
  /** Hide the section picker (used by the homepage banner player) */
  hideSectionPicker?: boolean;
  /** Hide the fullscreen button (used by the homepage banner player) */
  hideFullscreenButton?: boolean;
  /** Require an explicit user tap to start playback. No auto-play of any kind. */
  requireTapToStart?: boolean;
}


interface BeatVideoEntry {
  segmentIndex: number;
  startTime: number;
  endTime: number;
  videoPath: string | null;
  isShowPhase: boolean;
}

export const EducationalVideoPlayer = ({
  presentationData,
  jobId,
  getMediaUrl = getAdminMediaUrl,
  onClose,
  className,
  initialLanguage = null,
  serverIp,
  purchasedLanguages = [],
  courseAvailableLanguages,
  topicId,
  chapterId,
  subjectId,
  courseId,
  topicTitle,
  skipPreIntro = false,
  forceMobileLayout = false,
  hideSectionPicker = false,
  hideFullscreenButton = false,
  requireTapToStart = false,
}: EducationalVideoPlayerProps) => {
  // Read window.innerWidth synchronously — useIsMobile returns false on first render due to async useEffect
  const [isMobile] = useState(() => forceMobileLayout || window.innerWidth < 768);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(initialLanguage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentVideoSrc, setContentVideoSrc] = useState<string | null>(null);
  // Monotonic seek token: incremented ONLY when we intentionally want the
  // visual beat <video> to seek to segmentStartOffset. VideoLayer writes
  // currentTime only when this changes — never on ordinary renders.
  const [beatSeekToken, setBeatSeekToken] = useState(0);
  const beatEffectRunCountRef = useRef(0);
  const lastMasterTimeLogRef = useRef(0);
  const [failedSources, setFailedSources] = useState<Set<'vimeo' | 'local' | 'default' | 'language' | 'cdn'>>(new Set());
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarUnavailableDialog, setAvatarUnavailableDialog] = useState(false);
  const avatarUnavailableShownRef = useRef(false);
  const avatarUnavailableSectionsRef = useRef<Set<number>>(new Set());
  const [avatarBuffering, setAvatarBuffering] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [allAvatarsReady, setAllAvatarsReady] = useState(false);
  const [showPreIntro, setShowPreIntro] = useState(!skipPreIntro);
  const [preIntroEnded, setPreIntroEnded] = useState(skipPreIntro);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [userHasStarted, setUserHasStarted] = useState(!requireTapToStart);
  const preIntroVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenWrapperRef = useRef<HTMLDivElement>(null);
  const isFullscreenRef = useRef(false);
  const contentVideoRef = useRef<HTMLVideoElement>(null);
  const avatarVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const glRendererRef = useRef<ChromaKeyGL | null>(null);
  const useCPURef = useRef<boolean>(false);
  const chromaLoggedOnceRef = useRef<boolean>(false);
  // CPU fallback uses old HSL-based params; GPU path uses new YCbCr GL params
  const chromaParamsRef = useRef<ChromaKeyParams>(DEFAULT_CHROMA_PARAMS);
  const glParamsRef = useRef<GLChromaParams>(GL_DEFAULTS_GREEN);
  const keyColorSampledRef = useRef<boolean>(false);
  const [tunerOpen, setTunerOpen] = useState(false);
  const [glParamsState, setGlParamsState] = useState<GLChromaParams>(GL_DEFAULTS_GREEN);
  const [keyColorState, setKeyColorState] = useState<{ r: number; g: number; b: number }>({ r: 0, g: 177, b: 64 });
  const [detectedSample, setDetectedSample] = useState<{
    r: number; g: number; b: number; hex: string;
    confidence: number; source: 'auto' | 'default' | 'user';
    trigger?: string; sampledAt: number;
    status?: 'accepted' | 'rejected';
    rejectReason?: string;
  }>({ r: 0, g: 177, b: 64, hex: '#00B140', confidence: 0, source: 'default', sampledAt: 0, status: 'accepted' });
  const [rendererReadyVersion, setRendererReadyVersion] = useState(0);
  const keyColorRef = useRef<{ r: number; g: number; b: number }>({ r: 0, g: 177, b: 64 });
  const preloadedVideosRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const preloadedBeatVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Blob URL cache for beat (WAN/Manim) videos — keyed by the resolved proxy URL.
  const preloadedBeatBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const inFlightAvatarBlobFetchesRef = useRef<Map<number, Promise<boolean>>>(new Map());
  const inFlightBeatBlobFetchesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const preloadedSectionsRef = useRef<Set<number>>(new Set());
  const preloadedBlobUrlsRef = useRef<Map<number, string>>(new Map());
  const completedBeatSegmentsRef = useRef<Set<number>>(new Set());
  const beatVideoElementsRef = useRef<HTMLVideoElement[]>([]);
  const hasAutoPlayedRef = useRef(false);
  const pendingAutoPlayRef = useRef(false);
  const sectionSwitchTimestampRef = useRef(0);
  const [cacheProgress, setCacheProgress] = useState({ loaded: 0, total: 2 });
  const [contentVideoReady, setContentVideoReady] = useState(false);
  const [blobCacheVersion, setBlobCacheVersion] = useState(0);
  const readySectionsRef = useRef<Set<number>>(new Set());
  const bootRunIdRef = useRef(0);
  const cacheIdentityRef = useRef<string | null>(null);
  const [readyVersion, setReadyVersion] = useState(0);
  const [waitingForBlobs, setWaitingForBlobs] = useState(false);
  const userWantsPlayRef = useRef(false);
  const lastGatedSectionRef = useRef<number | null>(-1);
  const phase1BootPromiseRef = useRef<Promise<void> | null>(null);
  const phase1BootIdentityRef = useRef<string | null>(null);
  const phase1BootGenerationRef = useRef(0);
  const activeBeatEntryRef = useRef<{
    sectionIndex: number;
    segmentIndex: number;
    startTime: number;
    endTime: number;
    desiredDur: number;
    videoPath: string | null;
    videoUrl: string | null;
    enteredAtPlayerTime: number;
    enteredAtWallTime: number;
  } | null>(null);

  const sections = presentationData?.sections || [];
  const currentSection = sections[currentSectionIndex] || null;

  // [PRESENTATION] one-shot log: list every section's segments + desired times + beat videos
  const presentationLoggedRef = useRef(false);
  useEffect(() => {
    if (presentationLoggedRef.current) return;
    if (!presentationData?.sections?.length) return;
    presentationLoggedRef.current = true;
    console.log(`[PRESENTATION] Loaded ${presentationData.sections.length} sections`);
    presentationData.sections.forEach((sec, sIdx) => {
      const segs = sec.narration?.segments || [];
      const total = segs.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      console.log(
        `[PRESENTATION] section=${sIdx} type=${sec.section_type} title="${sec.title}" segments=${segs.length} totalDuration=${total.toFixed(2)}s`
      );
      if (segs.length) {
        try {
          console.table(
            segs.map((s, i) => ({
              seg: i,
              desiredTime_s: Number((s.duration_seconds || 0).toFixed(2)),
              beatVideo: s.beat_videos?.[0] || null,
              visualLayer: s.display_directives?.visual_layer || (sec.visual_layer ?? '—'),
              textPreview: (s.text || '').slice(0, 60),
            }))
          );
        } catch {
          /* console.table unsupported */
        }
      }
    });
  }, [presentationData]);

  // Completion tracker
  const eduLastTimeRef = useRef(0);
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

  // Fetch available language avatars for this job
  const { languages: allAvailableLanguages, avatarMap: languageAvatarMap, isLoading: availableLanguagesLoading } = useAvailableLanguages(jobId);
  
  // Filter languages for LanguagePicker: only show purchased languages
  const availableLanguages = allAvailableLanguages.filter(lang => {
    if (!courseAvailableLanguages || courseAvailableLanguages.length <= 1) return false;
    return purchasedLanguages.includes(lang);
  });

  useEffect(() => {
    if (!selectedLanguage) return;
    if (availableLanguagesLoading) return;
    if (availableLanguages.includes(selectedLanguage)) return;
    console.warn('[LANGUAGE PICKER] Selected language is not fully available for this lecture; resetting to English', {
      selectedLanguage,
      availableLanguages,
      jobId,
    });
    setSelectedLanguage(null);
  }, [availableLanguages, availableLanguagesLoading, selectedLanguage, jobId]);

  // Get video source settings - MUST be before preload effect
  const { primarySource: settingsPrimarySource, localServerIp, languageAvatarServerIp, languageFallback, vimeoFallback, localServerFallback, fallbackServerIp, cdnBaseUrl, cdnFallback, isLoading: settingsLoading } = useVideoSourceSettings();

  // When watching a specific job, force local_server to route media
  // to the correct hardware node (CDN/Vimeo may not have this job's files)
  const primarySource = serverIp ? 'local_server' as const : settingsPrimarySource;

  // When a job-specific serverIp is provided, override all server IPs
  const effectiveLocalServerIp = serverIp || localServerIp;
  const effectiveFallbackServerIp = serverIp || fallbackServerIp;
  const effectiveLanguageServerIp = serverIp || languageAvatarServerIp;

  // Mount/unmount logging
  useEffect(() => {
    console.log('[Player] MOUNTED');
    return () => console.log('[Player] UNMOUNTED');
  }, []);

  // Browser navigation event listeners (catch Android back gestures, etc.)
  useEffect(() => {
    const onVisChange = () => console.log('[Player] visibilitychange, hidden:', document.hidden);
    const onPageHide = () => console.log('[Player] pagehide fired');
    const onPopState = () => console.log('[Player] popstate fired (back button?)');
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Clear failed sources when language changes so new avatar URL is tried fresh
  useEffect(() => {
    console.log('[PLAYER] Language changed to:', selectedLanguage, '- clearing failed sources');
    setFailedSources(new Set());
  }, [selectedLanguage]);

  // Debug: Log section data when it changes
  useEffect(() => {
    const elapsed = performance.now() - sectionSwitchTimestampRef.current;
    console.log(`[SWITCH] Section state updated at t=${elapsed.toFixed(0)}ms`, {
      index: currentSectionIndex,
      type: currentSection?.section_type,
      title: currentSection?.title,
      segmentCount: currentSection?.narration?.segments?.length || 0,
      totalDuration: currentSection?.narration?.total_duration_seconds || 'N/A',
    });
    // Reset states on section change
    setContentVideoSrc(null);
    activeBeatEntryRef.current = null;
    setFailedSources(new Set()); // Clear failed sources to retry all on new section
    const isCurrentAvatarUnavailable = avatarUnavailableSectionsRef.current.has(currentSectionIndex);
    setAvatarLoading(!isCurrentAvatarUnavailable);
    setAvatarBuffering(false);
    setAvatarLoadFailed(isCurrentAvatarUnavailable); // Preserve presentation-only mode for known missing avatars
    prevPlayingRef.current = false; // Reset play tracking so sync effect detects state change
    completedBeatSegmentsRef.current.clear(); // Reset completed beat segments for new section
  }, [currentSection, currentSectionIndex]);

  // Helper: get avatar URL for a section index (for preloading)
  const getAvatarSrcForSection = useCallback((section: PresentationSection, index: number): string | null => {
    const sectionId = typeof section.section_id === 'number'
      ? section.section_id
      : parseInt(String(section.section_id ?? index + 1), 10) || index + 1;
    const isNonEnglishLang = !!selectedLanguage && selectedLanguage.toLowerCase() !== 'english';

    if (isNonEnglishLang) {
      const lang = selectedLanguage.toLowerCase();
      const langEntry = section.avatar_languages?.find(
        (entry) =>
          entry.language?.toLowerCase() === lang &&
          ['completed', 'ready', 'success'].includes(String(entry.status || '').toLowerCase())
      );

      // PRIORITY 1: durable CDN via video_path (never expires, our own proxy).
      const languagePath = langEntry?.video_path || getAvatarVideoPath(sectionId, selectedLanguage);
      if (languagePath) {
        return getCdnMediaUrl(jobId, String(languagePath).replace(/^\/+/, ''), cdnBaseUrl);
      }

      // PRIORITY 2: durable B2 / direct video_url.
      const durableUrl = (langEntry as any)?.video_url || langEntry?.b2_url;
      if (durableUrl) return durableUrl;

      // PRIORITY 3: Vimeo proxy page (renegotiates fresh signed mp4 server-side).
      if (langEntry?.vimeo_url) {
        const proxied = getVimeoProxyUrl(langEntry.vimeo_url);
        if (proxied) return proxied;
      }

      // PRIORITY 4 (last resort): the pre-signed vimeo_mp4_url. These carry
      // ?expires=<unix> and return 410 once elapsed — only use if still live.
      const signed = (langEntry as any)?.vimeo_mp4_url as string | undefined;
      if (signed && isVimeoSignedUrlLive(signed)) return signed;

      return null;
    }


    // English: mirror the non-English (Kannada, etc.) priority order.
    // PRIORITY 1: durable CDN via avatar_video / avatar.video_path or default path.
    const englishPath =
      (section.avatar_video && resolveMediaPath(section.avatar_video, 'avatar')) ||
      (section.avatar?.video_path && resolveMediaPath(section.avatar.video_path, 'avatar')) ||
      (sectionId ? getAvatarVideoPath(sectionId) : null);

    if (englishPath && cdnBaseUrl) {
      return getCdnMediaUrl(jobId, String(englishPath).replace(/^\/+/, ''), cdnBaseUrl);
    }

    // PRIORITY 2: durable B2 / direct video_url on section or avatar.
    const englishDurable =
      (section as any).video_url ||
      (section as any).b2_url ||
      (section.avatar as any)?.video_url ||
      (section.avatar as any)?.b2_url;
    if (englishDurable) return englishDurable as string;

    // PRIORITY 3: Vimeo proxy page (renegotiates fresh signed mp4 server-side, CORS-safe).
    if (section.vimeo_url) {
      const proxied = getVimeoProxyUrl(section.vimeo_url);
      if (proxied) return proxied;
    }

    // PRIORITY 4 (last resort): pre-signed vimeo_mp4_url — only if still live.
    const englishSigned = (section as any).vimeo_mp4_url as string | undefined;
    if (englishSigned && isVimeoSignedUrlLive(englishSigned)) return englishSigned;

    // Legacy fallbacks by primarySource (jobs not yet on CDN).
    if (primarySource === 'vimeo' && vimeoFallback !== 'none' && englishPath) {
      return getAdminMediaUrl(jobId, englishPath, effectiveFallbackServerIp);
    }
    if (primarySource === 'language_priority' && englishPath) {
      return getAdminMediaUrl(jobId, englishPath, effectiveLanguageServerIp);
    }
    if (englishPath) {
      return getAdminMediaUrl(jobId, englishPath, effectiveLocalServerIp);
    }
    return null;
  }, [jobId, primarySource, effectiveLocalServerIp, effectiveLanguageServerIp, effectiveFallbackServerIp, vimeoFallback, cdnBaseUrl, selectedLanguage]);

  // Helper: get beat video URL for preloading
  const getBeatVideoUrl = useCallback((videoPath: string): string => {
    const resolved = resolveMediaPath(videoPath, 'video');
    if (primarySource === 'cdn_server') return getCdnMediaUrl(jobId, resolved, cdnBaseUrl);
    if (primarySource === 'vimeo') {
      const vimeoUrl = getVimeoBeatVideoUrl(videoPath);
      if (vimeoUrl) return vimeoUrl;
      // Fallback to CDN proxy instead of direct IP
      return getCdnMediaUrl(jobId, resolved, cdnBaseUrl);
    }
    return getAdminMediaUrl(jobId, resolved, effectiveLocalServerIp);
  }, [jobId, primarySource, cdnBaseUrl, effectiveLocalServerIp, effectiveFallbackServerIp]);

  // Concurrency-limited runner (cap = 2) for beat blob fetches
  const runWithLimit = async <T,>(tasks: Array<() => Promise<T>>, limit = 2): Promise<T[]> => {
    const results: T[] = [];
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (i < tasks.length) {
        const idx = i++;
        try { results[idx] = await tasks[idx](); } catch { /* swallowed; logged inside task */ }
      }
    });
    await Promise.all(workers);
    return results;
  };

  const clearAllBlobCaches = useCallback((reason: string) => {
    console.warn(`[CACHE] Clearing blob caches: ${reason}`);
    preloadedVideosRef.current.forEach(v => { v.src = ''; v.load(); });
    preloadedVideosRef.current.clear();
    beatVideoElementsRef.current.forEach(v => { v.src = ''; v.load(); });
    beatVideoElementsRef.current = [];
    preloadedBeatVideosRef.current.clear();
    preloadedSectionsRef.current.clear();
    readySectionsRef.current.clear();
    preloadedBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    preloadedBlobUrlsRef.current.clear();
    preloadedBeatBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    preloadedBeatBlobUrlsRef.current.clear();
    inFlightAvatarBlobFetchesRef.current.clear();
    inFlightBeatBlobFetchesRef.current.clear();
    avatarUnavailableSectionsRef.current.clear();
    avatarUnavailableShownRef.current = false;
    setAvatarUnavailableDialog(false);
    setAvatarLoadFailed(false);
    setReadyVersion(v => v + 1);
    setBlobCacheVersion(v => v + 1);
  }, []);

  const markAvatarUnavailable = useCallback((sectionIndex: number, reason: string) => {
    console.warn(`[BLOB-AVATAR][UNAVAILABLE] section=${sectionIndex} reason=${reason}`);
    avatarUnavailableSectionsRef.current.add(sectionIndex);
    if (sectionIndex === currentSectionIndex) {
      setAvatarLoading(false);
      setAvatarBuffering(false);
      setAvatarLoadFailed(true);
    }
    if (!avatarUnavailableShownRef.current) {
      avatarUnavailableShownRef.current = true;
      setAvatarUnavailableDialog(true);
    }
    setReadyVersion(v => v + 1);
  }, [currentSectionIndex]);

  // Fetch a single URL into a blob. No timeout: large avatar/beat videos must be
  // allowed to finish instead of client-aborting the edge proxy stream.
  const fetchBlobWithGuards = async (url: string, label: string): Promise<string | null> => {
    const startedAt = performance.now();
    console.log(`[BLOB-BEAT][START] label=${label} url=${url}`);
    try {
      const res = await fetch(url);
      const elapsed = (performance.now() - startedAt).toFixed(0);
      console.log(`[BLOB-BEAT][HTTP] label=${label} status=${res.status} ok=${res.ok} ct=${res.headers.get('content-type')} cl=${res.headers.get('content-length')} elapsedMs=${elapsed}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`[BLOB-BEAT][BLOB-READ-START] label=${label} elapsedMs=${elapsed}`);
      const blob = await res.blob();
      const blobElapsed = (performance.now() - startedAt).toFixed(0);
      console.log(`[BLOB-BEAT][BLOB-READ-DONE] label=${label} sizeBytes=${blob.size} type=${blob.type || 'unknown'} elapsedMs=${blobElapsed}`);
      console.log(`[BLOB-BEAT][OBJECT-URL-START] label=${label}`);
      const blobUrl = URL.createObjectURL(blob);
      console.log(`[BLOB-BEAT][OBJECT-URL-DONE] label=${label} blobUrlReady=${Boolean(blobUrl)}`);
      const totalElapsed = (performance.now() - startedAt).toFixed(0);
      console.log(`[BLOB-BEAT][DONE] label=${label} sizeMB=${(blob.size / 1024 / 1024).toFixed(2)} totalMs=${totalElapsed}`);
      return blobUrl;
    } catch (err) {
      const elapsed = (performance.now() - startedAt).toFixed(0);
      console.warn(`[BLOB-BEAT][FAIL] label=${label} url=${url} elapsedMs=${elapsed} err=`, err);
      return null;
    }
  };

  // Preload avatar only (blob). Returns true only after the blob URL exists.
  const preloadAvatarOnly = useCallback(async (sectionIndex: number): Promise<boolean> => {
    console.log(`[BLOB-AVATAR][ENTER] section=${sectionIndex}`, {
      totalSections: sections.length,
      cached: preloadedBlobUrlsRef.current.has(sectionIndex),
      inFlight: inFlightAvatarBlobFetchesRef.current.has(sectionIndex),
      readySections: Array.from(readySectionsRef.current),
    });
    if (sectionIndex >= sections.length) {
      console.warn(`[BLOB-AVATAR][OUT-OF-RANGE] section=${sectionIndex} totalSections=${sections.length}`);
      return false;
    }
    if (preloadedBlobUrlsRef.current.has(sectionIndex)) {
      console.log(`[BLOB-AVATAR][SKIP] section=${sectionIndex} (already cached)`);
      return true;
    }
    const inFlight = inFlightAvatarBlobFetchesRef.current.get(sectionIndex);
    if (inFlight) {
      console.log(`[BLOB-AVATAR][WAIT] section=${sectionIndex} (joining in-flight fetch)`);
      return inFlight;
    }
    const section = sections[sectionIndex];
    const avatarSrc = getAvatarSrcForSection(section, sectionIndex);
    console.log(`[BLOB-AVATAR][RESOLVE] section=${sectionIndex}`, {
      title: section?.title,
      sectionId: section?.section_id,
      avatarVideo: section?.avatar_video,
      nestedAvatarVideoPath: section?.avatar?.video_path,
      resolvedUrl: avatarSrc,
      primarySource,
      effectiveLocalServerIp,
      effectiveLanguageServerIp,
      effectiveFallbackServerIp,
      cdnBaseUrl,
    });
    if (!avatarSrc) {
      console.warn(`[BLOB-AVATAR][NO-SRC] section=${sectionIndex} title="${section?.title}" — getAvatarSrcForSection returned null`);
      markAvatarUnavailable(sectionIndex, 'no-avatar-source');
      return true;
    }

    const promise = (async () => {
      const startedAt = performance.now();
      const requestIdentity = cacheIdentityRef.current;
      console.log(`[BLOB-AVATAR][START] section=${sectionIndex} title="${section?.title}" url=${avatarSrc}`);
      try {
        console.log(`[BLOB-AVATAR][FETCH-CALL] section=${sectionIndex} about to call fetch()`);
        const response = await fetch(avatarSrc);
        const elapsed = (performance.now() - startedAt).toFixed(0);
        console.log(`[BLOB-AVATAR][HTTP] section=${sectionIndex} status=${response.status} ok=${response.ok} ct=${response.headers.get('content-type')} cl=${response.headers.get('content-length')} elapsedMs=${elapsed}`);
        if (!response.ok) {
          if (response.status === 404) markAvatarUnavailable(sectionIndex, 'http-404');
          throw new Error(`HTTP ${response.status}`);
        }
        console.log(`[BLOB-AVATAR][BLOB-READ-START] section=${sectionIndex} elapsedMs=${elapsed}`);
        const blob = await response.blob();
        const blobElapsed = (performance.now() - startedAt).toFixed(0);
        console.log(`[BLOB-AVATAR][BLOB-READ-DONE] section=${sectionIndex} sizeBytes=${blob.size} type=${blob.type || 'unknown'} elapsedMs=${blobElapsed}`);
        console.log(`[BLOB-AVATAR][OBJECT-URL-START] section=${sectionIndex}`);
        const blobUrl = URL.createObjectURL(blob);
        console.log(`[BLOB-AVATAR][OBJECT-URL-DONE] section=${sectionIndex} blobUrlReady=${Boolean(blobUrl)}`);
        if (cacheIdentityRef.current !== requestIdentity) {
          console.warn(`[BLOB-AVATAR][STALE-SKIP] section=${sectionIndex} requestIdentity=${requestIdentity} activeIdentity=${cacheIdentityRef.current}`);
          URL.revokeObjectURL(blobUrl);
          return false;
        }
        preloadedBlobUrlsRef.current.set(sectionIndex, blobUrl);
        console.log(`[BLOB-AVATAR][CACHE-COMMIT] section=${sectionIndex} cached=${preloadedBlobUrlsRef.current.has(sectionIndex)} cacheSize=${preloadedBlobUrlsRef.current.size}`);
        setBlobCacheVersion(v => v + 1);
        console.log(`[BLOB-AVATAR][STATE-VERSION-SCHEDULED] section=${sectionIndex}`);
        const totalElapsed = (performance.now() - startedAt).toFixed(0);
        console.log(`[BLOB-AVATAR][DONE] section=${sectionIndex} sizeMB=${(blob.size / 1024 / 1024).toFixed(2)} totalMs=${totalElapsed}`);
        return true;
      } catch (err) {
        const elapsed = (performance.now() - startedAt).toFixed(0);
        console.warn(`[BLOB-AVATAR][FAIL] section=${sectionIndex} url=${avatarSrc} elapsedMs=${elapsed} err=`, err);
        return avatarUnavailableSectionsRef.current.has(sectionIndex);
      } finally {
        inFlightAvatarBlobFetchesRef.current.delete(sectionIndex);
      }
    })();
    inFlightAvatarBlobFetchesRef.current.set(sectionIndex, promise);
    return promise;
  }, [sections, getAvatarSrcForSection, markAvatarUnavailable]);

  // Preload all beats for a section as blobs. Concurrency is 1 to avoid proxy saturation.
  const preloadSectionBeats = useCallback(async (sectionIndex: number): Promise<boolean> => {
    if (sectionIndex >= sections.length) return false;
    const section = sections[sectionIndex];
    const requestIdentity = cacheIdentityRef.current;
    const segments = section.narration?.segments || [];
    const urls: { url: string; videoPath: string; segIdx: number }[] = [];
    const seenUrls = new Set<string>();
    segments.forEach((segment, segIdx) => {
      (segment.beat_videos || []).forEach((videoPath) => {
        if (!videoPath) return;
        const url = getBeatVideoUrl(videoPath);
        if (seenUrls.has(url)) return;
        seenUrls.add(url);
        if (preloadedBeatBlobUrlsRef.current.has(url)) return;
        urls.push({ url, videoPath, segIdx });
      });
    });
    console.log(`[BEATS][START] section=${sectionIndex} segments=${segments.length} pendingBeats=${urls.length}`, urls.map(u => ({ seg: u.segIdx, path: u.videoPath })));
    if (urls.length === 0) return true;

    const tasks = urls.map(({ url, videoPath, segIdx }) => async () => {
      const label = `s${sectionIndex}-seg${segIdx}-${videoPath}`;
      let promise = inFlightBeatBlobFetchesRef.current.get(url);
      if (promise) {
        console.log(`[BLOB-BEAT][WAIT] label=${label} (joining in-flight fetch)`);
      } else {
        promise = fetchBlobWithGuards(url, label).finally(() => {
          inFlightBeatBlobFetchesRef.current.delete(url);
        });
        inFlightBeatBlobFetchesRef.current.set(url, promise);
      }
      const blobUrl = await promise;
      if (blobUrl) {
        if (cacheIdentityRef.current !== requestIdentity) {
          console.warn(`[BLOB-BEAT][STALE-SKIP] label=${label} requestIdentity=${requestIdentity} activeIdentity=${cacheIdentityRef.current}`);
          URL.revokeObjectURL(blobUrl);
          return false;
        }
        preloadedBeatBlobUrlsRef.current.set(url, blobUrl);
        setBlobCacheVersion(v => v + 1);
        return true;
      }
      return false;
    });
    const results = await runWithLimit(tasks, 1);
    const ok = results.length === urls.length && results.every(Boolean);
    console.log(`[BEATS][DONE] section=${sectionIndex} attempted=${urls.length} cached=${results.filter(Boolean).length} ok=${ok}`);
    return ok;
  }, [sections, getBeatVideoUrl]);

  // Check: is a section's avatar + every beat already cached as blobs?
  const getSectionCacheReport = useCallback((sectionIndex: number) => {
    const section = sections[sectionIndex];
    if (!section) {
      return {
        ready: false,
        reason: 'section-missing',
        hasAvatarBlob: false,
        expectedAvatarUrl: null as string | null,
        missingBeatUrls: [] as string[],
        totalBeatUrls: 0,
      };
    }

    const expectedAvatarUrl = getAvatarSrcForSection(section, sectionIndex);
    const hasAvatarBlob = preloadedBlobUrlsRef.current.has(sectionIndex);
    const avatarUnavailable = avatarUnavailableSectionsRef.current.has(sectionIndex);
    const beatUrls = new Set<string>();
    const segments = section.narration?.segments || [];

    for (const segment of segments) {
      for (const videoPath of (segment.beat_videos || [])) {
        if (!videoPath) continue;
        beatUrls.add(getBeatVideoUrl(videoPath));
      }
    }

    const missingBeatUrls = Array.from(beatUrls).filter(url => !preloadedBeatBlobUrlsRef.current.has(url));

    return {
      ready: (hasAvatarBlob || avatarUnavailable) && missingBeatUrls.length === 0,
      reason: !hasAvatarBlob && !avatarUnavailable ? 'avatar-blob-missing' : missingBeatUrls.length ? 'beat-blob-missing' : 'ready',
      hasAvatarBlob,
      avatarUnavailable,
      expectedAvatarUrl,
      missingBeatUrls,
      totalBeatUrls: beatUrls.size,
    };
  }, [sections, getAvatarSrcForSection, getBeatVideoUrl]);

  const isSectionReady = useCallback((sectionIndex: number): boolean => {
    return getSectionCacheReport(sectionIndex).ready;
  }, [getSectionCacheReport]);

  // Full section preload (avatar FIRST, then beats) — serialized to avoid
  // saturating the edge-function proxy with parallel large-file streams.
  const preloadSection = useCallback(async (sectionIndex: number): Promise<boolean> => {
    if (sectionIndex >= sections.length) return false;
    if (readySectionsRef.current.has(sectionIndex) && isSectionReady(sectionIndex)) return true;
    if (readySectionsRef.current.has(sectionIndex) && !isSectionReady(sectionIndex)) {
      readySectionsRef.current.delete(sectionIndex);
    }
    // 1) Avatar first (largest single file) — must finish before beats start
    const avatarReady = await preloadAvatarOnly(sectionIndex);
    if (!avatarReady) {
      console.warn(`[CACHE] Section ${sectionIndex} avatar is not blob-ready; beats skipped until retry`);
      return false;
    }
    // 2) Then visual beats for the same section
    await preloadSectionBeats(sectionIndex);
    if (isSectionReady(sectionIndex)) {
      readySectionsRef.current.add(sectionIndex);
      preloadedSectionsRef.current.add(sectionIndex);
      setReadyVersion(v => v + 1);
      console.log(`[CACHE] Section ${sectionIndex} READY (avatar + all beats blob-cached)`);
      return true;
    } else {
      const report = getSectionCacheReport(sectionIndex);
      console.warn(`[CACHE] Section ${sectionIndex} NOT READY after preload`, {
        reason: report.reason,
        hasAvatarBlob: report.hasAvatarBlob,
        expectedAvatarUrl: report.expectedAvatarUrl,
        totalBeatUrls: report.totalBeatUrls,
        missingBeatCount: report.missingBeatUrls.length,
        missingBeatUrls: report.missingBeatUrls,
      });
      return false;
    }
  }, [sections, preloadAvatarOnly, preloadSectionBeats, isSectionReady, getSectionCacheReport]);

  // Phase 1: Gated boot — one owner per job identity. It must preload
  // section 0 avatar → section 0 beats → section 1 avatar → section 1 beats...
  // before lecture starts. Do not cancel/restart this loop on harmless re-renders;
  // React StrictMode cleanup was causing multiple overlapping owners.
  useEffect(() => {
    console.log('[BOOT][PHASE1][ENTER]', {
      hasPresentationData: Boolean(presentationData),
      presentationSections: presentationData?.sections?.length || 0,
      settingsLoading,
      allAvatarsReady,
      jobId,
      primarySource,
      effectiveLocalServerIp,
      effectiveFallbackServerIp,
      effectiveLanguageServerIp,
      cdnBaseUrl,
      currentCacheIdentity: cacheIdentityRef.current,
      currentBootRunId: bootRunIdRef.current,
      cachedAvatars: Array.from(preloadedBlobUrlsRef.current.keys()),
      cachedBeatCount: preloadedBeatBlobUrlsRef.current.size,
      readySections: Array.from(readySectionsRef.current),
    });
    if (!presentationData?.sections || presentationData.sections.length === 0) {
      console.warn('[BOOT][PHASE1][SKIP] no presentation sections');
      return;
    }
    if (settingsLoading) {
      console.warn('[BOOT][PHASE1][SKIP] settings still loading');
      return;
    }

    const INITIAL_CACHE_COUNT = Math.min(2, presentationData.sections.length);
    const cacheIdentity = [
      jobId,
      primarySource,
      effectiveLocalServerIp || '',
      effectiveFallbackServerIp || '',
      effectiveLanguageServerIp || '',
      cdnBaseUrl || '',
      selectedLanguage || 'english',
      presentationData.sections.length,
    ].join('|');
    if (cacheIdentityRef.current !== cacheIdentity) {
      console.warn('[BOOT][PHASE1][IDENTITY-CHANGE]', {
        previous: cacheIdentityRef.current,
        next: cacheIdentity,
      });
      cacheIdentityRef.current = cacheIdentity;
      phase1BootIdentityRef.current = null;
      phase1BootPromiseRef.current = null;
      phase1BootGenerationRef.current += 1;
      setAllAvatarsReady(false);
      setWaitingForBlobs(false);
      hasAutoPlayedRef.current = false;
      pendingAutoPlayRef.current = false;
      clearAllBlobCaches(`new boot identity ${cacheIdentity}`);
    }

    if (phase1BootIdentityRef.current === cacheIdentity && phase1BootPromiseRef.current) {
      console.log('[BOOT][PHASE1][JOIN-EXISTING]', {
        identity: cacheIdentity,
        bootRunId: bootRunIdRef.current,
      });
      return;
    }

    const alreadyReadyCount = Array.from({ length: INITIAL_CACHE_COUNT }, (_, i) => i)
      .filter(i => isSectionReady(i)).length;
    if (phase1BootIdentityRef.current === cacheIdentity && alreadyReadyCount === INITIAL_CACHE_COUNT) {
      console.log('[BOOT][PHASE1][SKIP-READY]', {
        identity: cacheIdentity,
        ready: alreadyReadyCount,
        total: INITIAL_CACHE_COUNT,
      });
      setCacheProgress({ loaded: INITIAL_CACHE_COUNT, total: INITIAL_CACHE_COUNT });
      setAllAvatarsReady(true);
      return;
    }

    const bootRunId = ++bootRunIdRef.current;
    const bootGeneration = phase1BootGenerationRef.current;
    phase1BootIdentityRef.current = cacheIdentity;
    console.log('[BOOT][PHASE1] Starting SERIALIZED gated boot', {
      bootRunId,
      bootGeneration,
      jobId,
      primarySource,
      effectiveLocalServerIp,
      effectiveFallbackServerIp,
      effectiveLanguageServerIp,
      cdnBaseUrl,
      settingsLoading,
      totalSections: presentationData.sections.length,
      gatingFirstN: INITIAL_CACHE_COUNT,
    });
    const setBootProgress = (loaded: number) => {
      const safeLoaded = Math.min(Math.max(loaded, 0), INITIAL_CACHE_COUNT);
      setCacheProgress({ loaded: safeLoaded, total: INITIAL_CACHE_COUNT });
      console.log(`[BOOT][PHASE1][PROGRESS] run=${bootRunId} ${safeLoaded}/${INITIAL_CACHE_COUNT}`);
    };
    setBootProgress(0);

    const bootPromise = (async () => {
      console.log(`[BOOT][PHASE1][LOOP-START] run=${bootRunId} initialCount=${INITIAL_CACHE_COUNT}`);
      // Pass 1: serialized section-by-section preload
      for (let i = 0; i < INITIAL_CACHE_COUNT; i++) {
        if (phase1BootGenerationRef.current !== bootGeneration) {
          console.warn(`[BOOT][PHASE1][ABORT-BEFORE-SECTION] run=${bootRunId} section=${i}`, {
            reason: 'identity-changed',
            activeBootRunId: bootRunIdRef.current,
            activeGeneration: phase1BootGenerationRef.current,
          });
          return;
        }
        console.log(`[BOOT][PHASE1] → Preloading section ${i} (avatar then beats) run=${bootRunId}`);
        const ok = await preloadSection(i);
        if (phase1BootGenerationRef.current !== bootGeneration) {
          console.warn(`[BOOT][PHASE1][ABORT-AFTER-SECTION] run=${bootRunId} section=${i}`, {
            reason: 'identity-changed',
            activeBootRunId: bootRunIdRef.current,
            activeGeneration: phase1BootGenerationRef.current,
            ok,
          });
          return;
        }
        if (ok && isSectionReady(i)) {
          const loadedCount = Array.from({ length: INITIAL_CACHE_COUNT }, (_, idx) => idx)
            .filter(idx => isSectionReady(idx)).length;
          setBootProgress(loadedCount);
        } else {
          console.warn(`[BOOT][PHASE1] Section ${i} did not finish; progress not advanced`, getSectionCacheReport(i));
        }
      }
      // Pass 2: serial retry for any section that didn't end up ready
      for (let attempt = 0; attempt < 2; attempt++) {
        const missing = Array.from({ length: INITIAL_CACHE_COUNT }, (_, i) => i)
          .filter(i => !isSectionReady(i));
        if (missing.length === 0) break;
        console.warn(`[CACHE] Boot retry ${attempt + 1} for sections (serial)`, missing);
        for (const i of missing) {
          if (phase1BootGenerationRef.current !== bootGeneration) return;
          const ok = await preloadSection(i);
          if (phase1BootGenerationRef.current !== bootGeneration) return;
          if (ok && isSectionReady(i)) {
            const loadedCount = Array.from({ length: INITIAL_CACHE_COUNT }, (_, idx) => idx)
              .filter(idx => isSectionReady(idx)).length;
            setBootProgress(loadedCount);
          }
        }
      }
      const allReady = Array.from({ length: INITIAL_CACHE_COUNT }, (_, i) => i)
        .every(i => isSectionReady(i));
      if (allReady) {
        console.log('[CACHE] Boot ready — first sections fully cached, starting lecture');
        setBootProgress(INITIAL_CACHE_COUNT);
        setAllAvatarsReady(true);
      } else {
        const missingReports = Array.from({ length: INITIAL_CACHE_COUNT }, (_, i) => i)
          .filter(i => !isSectionReady(i))
          .map(i => ({ section: i, ...getSectionCacheReport(i) }));
        console.error('[CACHE] STRICT BOOT BLOCKED — first sections are not fully blob-cached', missingReports);
        setAllAvatarsReady(false);
      }
    })().finally(() => {
      if (phase1BootIdentityRef.current === cacheIdentity) {
        phase1BootPromiseRef.current = null;
      }
      console.log('[BOOT][PHASE1][DONE-OR-STOPPED]', {
        bootRunId,
        bootGeneration,
        identity: cacheIdentity,
        activeGeneration: phase1BootGenerationRef.current,
        cachedAvatars: Array.from(preloadedBlobUrlsRef.current.keys()),
        cachedBeatCount: preloadedBeatBlobUrlsRef.current.size,
        readySections: Array.from(readySectionsRef.current),
      });
    });

    phase1BootPromiseRef.current = bootPromise;


    return () => {
      console.warn(`[BOOT][PHASE1][CLEANUP-NO-CANCEL] run=${bootRunId}`, {
        activeBootRunId: bootRunIdRef.current,
        activeGeneration: phase1BootGenerationRef.current,
        cachedAvatars: Array.from(preloadedBlobUrlsRef.current.keys()),
        cachedBeatCount: preloadedBeatBlobUrlsRef.current.size,
        readySections: Array.from(readySectionsRef.current),
      });
    };
  }, [presentationData, settingsLoading, preloadSection, primarySource, getSectionCacheReport, isSectionReady, clearAllBlobCaches, jobId, effectiveLocalServerIp, effectiveFallbackServerIp, effectiveLanguageServerIp, cdnBaseUrl, selectedLanguage]);

  // Phase 2: sequential background prefetch — load next 3 sections one by one
  useEffect(() => {
    if (!allAvatarsReady) return;
    if (!sections.length) return;

    let cancelled = false;
    (async () => {
      const LOOKAHEAD = 3;
      const start = currentSectionIndex + 1;
      const end = Math.min(start + LOOKAHEAD, sections.length);
      for (let i = start; i < end; i++) {
        if (cancelled) return;
        if (readySectionsRef.current.has(i)) continue;
        console.log(`[CACHE] Phase 2: prefetching section ${i} (watching ${currentSectionIndex})`);
        await preloadSection(i);
      }
    })();
    return () => { cancelled = true; };
  }, [currentSectionIndex, allAvatarsReady, sections.length, preloadSection]);





  // Memory guard: revoke blobs for sections more than 2 behind current.
  // Never revoke blobs (or beat URLs) still referenced by sections >= keepFrom.
  useEffect(() => {
    if (!sections.length) return;
    const keepFrom = currentSectionIndex - 2;
    if (keepFrom <= 0) return;

    // Build set of beat URLs still in use by retained sections.
    const stillUsed = new Set<string>();
    for (let i = keepFrom; i < sections.length; i++) {
      const segs = sections[i]?.narration?.segments || [];
      segs.forEach(s => (s.beat_videos || []).forEach(p => {
        if (p) stillUsed.add(getBeatVideoUrl(p));
      }));
    }

    preloadedBlobUrlsRef.current.forEach((url, idx) => {
      if (idx < keepFrom) {
        URL.revokeObjectURL(url);
        preloadedBlobUrlsRef.current.delete(idx);
        preloadedSectionsRef.current.delete(idx);
        readySectionsRef.current.delete(idx);
        console.log(`[CACHE] Revoked avatar blob for section ${idx}`);
      }
    });
    for (let idx = 0; idx < keepFrom; idx++) {
      const section = sections[idx];
      if (!section) continue;
      const segments = section.narration?.segments || [];
      segments.forEach((segment) => {
        (segment.beat_videos || []).forEach((videoPath) => {
          if (!videoPath) return;
          const url = getBeatVideoUrl(videoPath);
          if (stillUsed.has(url)) return;
          const blobUrl = preloadedBeatBlobUrlsRef.current.get(url);
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            preloadedBeatBlobUrlsRef.current.delete(url);
          }
        });
      });
    }
  }, [currentSectionIndex, sections, getBeatVideoUrl]);



  // Player state management
  const {
    state,
    totalDuration,
    setAvatarVideoRef,
    togglePlayPause,
    seek,
    reset,
    play,
    pause,
    forceTimerMode,
  } = usePlayerState({
    section: currentSection,
    onSectionEnd: () => {
      if (currentSectionIndex < sections.length - 1) {
        console.log('[SECTION END] Auto-advancing to next section');
        handleSectionChange(currentSectionIndex + 1, true);
      } else {
        console.log('[SECTION END] Presentation complete');
      }
    },
  });

  useEffect(() => {
    if (!avatarLoadFailed) return;
    forceTimerMode();
  }, [avatarLoadFailed, forceTimerMode]);

  // Mid-playback gate (intent-aware): only fires on section change.
  // If the new section isn't ready, pause once and kick off preload.
  useEffect(() => {
    if (!allAvatarsReady) return;
    if (!sections.length) return;
    if (currentSectionIndex >= sections.length) return;
    if (lastGatedSectionRef.current === currentSectionIndex) return;
    lastGatedSectionRef.current = currentSectionIndex;

    if (isSectionReady(currentSectionIndex)) {
      if (waitingForBlobs) setWaitingForBlobs(false);
      return;
    }
    console.log(`[CACHE] Section ${currentSectionIndex} NOT ready — pausing for blobs`);
    setWaitingForBlobs(true);
    try { pause(); } catch {}
    preloadSection(currentSectionIndex);
  }, [currentSectionIndex, allAvatarsReady, sections.length, isSectionReady, preloadSection, pause, waitingForBlobs]);

  // Readiness watcher: when a gated section becomes ready, auto-resume only
  // if the user wanted to be playing. Never pauses a ready section.
  useEffect(() => {
    if (!waitingForBlobs) return;
    if (!isSectionReady(currentSectionIndex)) return;
    console.log(`[CACHE] Section ${currentSectionIndex} ready — clearing wait`);
    setWaitingForBlobs(false);
    if (userWantsPlayRef.current) {
      try { play(); } catch {}
    }
  }, [waitingForBlobs, currentSectionIndex, isSectionReady, readyVersion, blobCacheVersion, play]);

  // User-intent-aware play/pause wrapper
  const handleTogglePlayPause = useCallback(() => {
    const willPlay = !state.isPlaying;
    userWantsPlayRef.current = willPlay;
    // Always honor a Pause tap. Only gate Play if the section is truly not ready
    // AND the initial boot hasn't completed yet (avoid blocking later taps).
    if (willPlay && !allAvatarsReady && !isSectionReady(currentSectionIndex)) {
      console.warn('[CACHE] Play blocked until current section is blob-ready', {
        section: currentSectionIndex,
        ...getSectionCacheReport(currentSectionIndex),
      });
      setWaitingForBlobs(true);
      preloadSection(currentSectionIndex);
      return; // readiness watcher will auto-play once ready
    }
    togglePlayPause();
  }, [state.isPlaying, togglePlayPause, isSectionReady, currentSectionIndex, preloadSection, getSectionCacheReport, allAvatarsReady]);



  // ===== Auto-hiding overlay chrome (header + controls) =====
  const [chromeVisible, setChromeVisible] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearHideTimer();
    if (!state.isPlaying || notesOpen) return;
    hideTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, 2500);
  }, [state.isPlaying, notesOpen, clearHideTimer]);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  // Keep chrome visible while paused or while the notebook is open.
  useEffect(() => {
    if (notesOpen) {
      clearHideTimer();
      setChromeVisible(true);
    } else if (state.isPlaying) {
      scheduleAutoHide();
    } else {
      clearHideTimer();
      setChromeVisible(true);
    }
    return clearHideTimer;
  }, [state.isPlaying, notesOpen, scheduleAutoHide, clearHideTimer]);

  const handleRootClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.player-header, .player-controls')) {
      // Interaction inside chrome — keep visible, reset timer.
      showChrome();
      return;
    }
    if (notesOpen) {
      setChromeVisible(true);
      clearHideTimer();
      return;
    }
    setChromeVisible((v) => {
      const next = !v;
      if (next) {
        scheduleAutoHide();
      } else {
        clearHideTimer();
      }
      return next;
    });
  }, [notesOpen, showChrome, scheduleAutoHide, clearHideTimer]);

  const lastMoveRef = useRef<number>(0);
  const handleRootPointerMove = useCallback(() => {
    const now = Date.now();
    if (now - lastMoveRef.current < 120) return;
    lastMoveRef.current = now;
    showChrome();
  }, [showChrome]);



  // Get avatar URL based on primary source setting
  const avatarUrl = useMemo((): { url: string; source: 'vimeo' | 'local' | 'default' | 'language' | 'cdn' } | null => {
    if (!currentSection || settingsLoading) return null;
    const activeCacheLanguage = selectedLanguage || 'english';
    const cacheMatchesLanguage = cacheIdentityRef.current?.includes(`|${activeCacheLanguage}|`) ?? false;
    const blobUrl = preloadedBlobUrlsRef.current.get(currentSectionIndex);

    if (blobUrl && cacheMatchesLanguage && !(selectedLanguage ? failedSources.has('language') : failedSources.has('local'))) {
      console.log(`[BLOB] Using ${activeCacheLanguage} blob URL for section ${currentSectionIndex}`);
      return { url: blobUrl, source: selectedLanguage ? 'language' : 'local' };
    }
    
    // Helper to get local server URL - accepts optional serverIp for fallback scenarios
    const getLocalUrl = (svrIp: string = effectiveLocalServerIp) => {
      if (currentSection.avatar_video && !failedSources.has('local')) {
        const path = resolveMediaPath(currentSection.avatar_video, 'avatar');
        console.log('[AVATAR] Trying local avatar_video:', path, 'Server:', serverIp);
        return { url: getAdminMediaUrl(jobId, path, svrIp), source: 'local' as const };
      }
      if (currentSection.avatar?.video_path && !failedSources.has('local')) {
        const path = resolveMediaPath(currentSection.avatar.video_path, 'avatar');
        console.log('[AVATAR] Trying avatar.video_path:', path, 'Server:', serverIp);
        return { url: getAdminMediaUrl(jobId, path, svrIp), source: 'local' as const };
      }
      // Default pattern
      const sectionId = currentSection.section_id;
      if (sectionId !== undefined && !failedSources.has('default')) {
        const path = getAvatarVideoPath(typeof sectionId === 'number' 
          ? sectionId 
          : parseInt(String(sectionId), 10) || 0);
        console.log('[AVATAR] Trying default pattern:', path, 'Server:', serverIp);
        return { url: getAdminMediaUrl(jobId, path, svrIp), source: 'default' as const };
      }
      return null;
    };

    // Helper to get Vimeo URL — CORS-safe order:
    //   1. Vimeo proxy (renegotiates fresh signed mp4 with CORS)
    //   2. Pre-signed section.vimeo_mp4_url only if still live
    const getVimeoUrl = () => {
      if (failedSources.has('vimeo')) return null;
      if (currentSection.vimeo_url && currentSection.vimeo_uploaded) {
        const proxyUrl = getVimeoProxyUrl(currentSection.vimeo_url);
        if (proxyUrl) {
          console.log('[AVATAR] Using Vimeo (proxy):', currentSection.vimeo_url);
          return { url: proxyUrl, source: 'vimeo' as const };
        }
      }
      const signed = (currentSection as any).vimeo_mp4_url as string | undefined;
      if (signed && isVimeoSignedUrlLive(signed)) {
        console.log('[AVATAR] Using Vimeo MP4 direct (live signed):', signed);
        return { url: signed, source: 'vimeo' as const };
      }
      return null;
    };

    // Helper to get CDN URL
    const getCdnUrl = () => {
      if (failedSources.has('cdn')) return null;
      
      if (currentSection.avatar_video) {
        const path = resolveMediaPath(currentSection.avatar_video, 'avatar');
        console.log('[AVATAR] Trying CDN avatar_video:', path);
        return { url: getCdnMediaUrl(jobId, path, cdnBaseUrl), source: 'cdn' as const };
      }
      if (currentSection.avatar?.video_path) {
        const path = resolveMediaPath(currentSection.avatar.video_path, 'avatar');
        console.log('[AVATAR] Trying CDN avatar.video_path:', path);
        return { url: getCdnMediaUrl(jobId, path, cdnBaseUrl), source: 'cdn' as const };
      }
      // Default pattern
      const sectionId = currentSection.section_id;
      if (sectionId !== undefined) {
        const path = getAvatarVideoPath(typeof sectionId === 'number' 
          ? sectionId 
          : parseInt(String(sectionId), 10) || 0);
        console.log('[AVATAR] Trying CDN default pattern:', path);
        return { url: getCdnMediaUrl(jobId, path, cdnBaseUrl), source: 'cdn' as const };
      }
      return null;
    };

    // LANGUAGE OVERRIDE (highest priority): If user picked a non-English language,
    // ALWAYS stream that language's avatar from CDN/Vimeo — never fall back to the
    // preloaded English blob (which would play English audio).
    const isNonEnglishLang = !!selectedLanguage && selectedLanguage.toLowerCase() !== 'english';
    if (isNonEnglishLang) {
      const langEntry = currentSection.avatar_languages?.find(
        l => l.language?.toLowerCase() === selectedLanguage!.toLowerCase()
          && (l.status === 'completed' || l.status === 'ready' || l.status === 'success')
      );
      if (langEntry) {
        // PRIORITY 1: durable CDN via video_path (never expires).
        if (langEntry.video_path) {
          const path = String(langEntry.video_path).replace(/^\/+/, '');
          const cdnUrl = getCdnMediaUrl(jobId, path, cdnBaseUrl);
          console.log('[AVATAR] Using language avatar from video_path via CDN proxy:', selectedLanguage, path);
          return { url: cdnUrl, source: 'language' };
        }
        // PRIORITY 2: durable B2 / direct video_url.
        const durableUrl = (langEntry as any).video_url || (langEntry as any).b2_url;
        if (durableUrl) {
          console.log('[AVATAR] Using language avatar durable URL:', selectedLanguage, durableUrl);
          return { url: durableUrl, source: 'language' };
        }
        // PRIORITY 3: Vimeo proxy page (server renegotiates fresh signature).
        if (langEntry.vimeo_url) {
          const proxyUrl = getVimeoProxyUrl(langEntry.vimeo_url);
          if (proxyUrl) {
            console.log('[AVATAR] Using language avatar via Vimeo proxy:', selectedLanguage, langEntry.vimeo_url);
            return { url: proxyUrl, source: 'language' };
          }
        }
        // PRIORITY 4 (last resort): pre-signed vimeo_mp4_url — skip if expired.
        const signed = (langEntry as any).vimeo_mp4_url as string | undefined;
        if (signed && isVimeoSignedUrlLive(signed)) {
          console.log('[AVATAR] Using language Vimeo signed MP4 (still live):', selectedLanguage);
          return { url: signed, source: 'language' };
        }
        if (signed) {
          console.warn('[AVATAR] Skipping expired Vimeo signed URL for', selectedLanguage, 'section', currentSection.section_id);
        }
        console.warn('[AVATAR] Language entry has no usable URL', {
          selectedLanguage,
          sectionId: currentSection.section_id,
        });
      }


      // Fallback: derived language avatar map (from language_avatar_jobs table)
      const currentSectionId = typeof currentSection.section_id === 'number'
        ? currentSection.section_id
        : parseInt(String(currentSection.section_id ?? currentSectionIndex + 1), 10) || currentSectionIndex + 1;
      const langAvatar = languageAvatarMap?.[selectedLanguage!.toLowerCase()]?.[currentSectionId];
      if (langAvatar?.avatarUrl) {
        console.log('[AVATAR] Using language avatar from avatarMap:', selectedLanguage);
        return { url: langAvatar.avatarUrl, source: 'language' };
      }

      // Last-resort fallback: construct the conventional CDN path directly
      // (avatars/{lang}/section_{id}_avatar.mp4). Covers sections whose
      // avatar_languages entry is missing but where the file exists on CDN.
      const sid = typeof currentSection.section_id === 'number'
        ? currentSection.section_id
        : parseInt(String(currentSection.section_id ?? currentSectionIndex), 10) || currentSectionIndex;
      const conventionalPath = getAvatarVideoPath(sid, selectedLanguage);
      const conventionalUrl = getCdnMediaUrl(jobId, conventionalPath, cdnBaseUrl);
      console.log('[AVATAR] Using conventional CDN path for language:', selectedLanguage, conventionalPath);
      return { url: conventionalUrl, source: 'language' };
    }

    // BLOB URL CHECK: Use cached blob for instant playback (English only)
    // Strict blob mode: while Phase 1 boot is preparing, never let the hidden
    // avatar <video> stream directly from the proxy.
    if (!allAvatarsReady) {
      console.warn('[AVATAR] Waiting for serialized blob cache before assigning video src', {
        section: currentSectionIndex,
        cachedAvatars: Array.from(preloadedBlobUrlsRef.current.keys()),
        cachedBeatCount: preloadedBeatBlobUrlsRef.current.size,
      });
      return null;
    }


    // CANONICAL: try CDN first for every job (CORS-safe, never expires),
    // then fall through to the primarySource-specific chain below.
    if (cdnBaseUrl && !failedSources.has('cdn')) {
      const cdnFirst = getCdnUrl();
      if (cdnFirst) return cdnFirst;
    }

    // PRIMARY SOURCE: VIMEO
    if (primarySource === 'vimeo') {
      const vimeoResult = getVimeoUrl();
      if (vimeoResult) return vimeoResult;
      // Use vimeoFallback setting - use fallbackServerIp for fallback
      if (vimeoFallback !== 'none') {
        console.log('[AVATAR] Vimeo not available, using fallback:', vimeoFallback, 'Server:', effectiveFallbackServerIp);
        return getLocalUrl(effectiveFallbackServerIp);
      }
      console.log('[AVATAR] Vimeo not available and no fallback configured');
      return null;
    }

    // PRIMARY SOURCE: LOCAL SERVER
    if (primarySource === 'local_server') {
      const localResult = getLocalUrl();
      if (localResult) return localResult;
      // Use localServerFallback setting
      if (localServerFallback === 'vimeo') {
        console.log('[AVATAR] Local not available, using Vimeo fallback');
        return getVimeoUrl();
      }
      console.log('[AVATAR] Local not available and no fallback configured');
      return null;
    }

    // PRIMARY SOURCE: LANGUAGE PRIORITY
    if (primarySource === 'language_priority') {
      // Try language avatar first
      if (selectedLanguage && !failedSources.has('language')) {
        const currentSectionId = typeof currentSection.section_id === 'number'
          ? currentSection.section_id
          : parseInt(String(currentSection.section_id ?? currentSectionIndex + 1), 10) || currentSectionIndex + 1;
        const langAvatar = languageAvatarMap?.[selectedLanguage]?.[currentSectionId];
        if (langAvatar?.avatarUrl && langAvatar.status === 'completed') {
          const proxiedUrl = getChatterboxProxyUrl(langAvatar.avatarUrl, effectiveLanguageServerIp);
          if (proxiedUrl) {
            console.log('[AVATAR] Using language avatar:', selectedLanguage);
            return { url: proxiedUrl, source: 'language' };
          }
        }
      }
      // Fallback based on setting - use fallbackServerIp for local fallback
      console.log('[AVATAR] Language avatar not available, using fallback:', languageFallback, 'Server:', effectiveFallbackServerIp);
      if (languageFallback === 'vimeo') {
        const vimeoResult = getVimeoUrl();
        if (vimeoResult) return vimeoResult;
      }
      return getLocalUrl(effectiveFallbackServerIp);
    }

    // PRIMARY SOURCE: CDN SERVER
    if (primarySource === 'cdn_server') {
      const cdnResult = getCdnUrl();
      if (cdnResult) return cdnResult;
      
      // Fallback chain based on cdnFallback setting — always route through CDN proxy, never direct IP
      if (cdnFallback === 'local_server') {
        console.log('[AVATAR] CDN primary failed, retrying via CDN proxy (no direct IP)');
        // Re-use getCdnUrl which already routes through server1.simplelecture.com
        const cdnRetry = getCdnUrl();
        if (cdnRetry) return cdnRetry;
      }
      if (cdnFallback === 'vimeo') {
        console.log('[AVATAR] CDN not available, using Vimeo fallback');
        return getVimeoUrl();
      }
      console.log('[AVATAR] CDN not available and no fallback configured');
      return null;
    }

    console.log('[AVATAR] All sources failed or unavailable');
    return null;
  }, [currentSection, currentSectionIndex, selectedLanguage, languageAvatarMap, jobId, getMediaUrl, failedSources, primarySource, effectiveLocalServerIp, effectiveLanguageServerIp, languageFallback, vimeoFallback, localServerFallback, effectiveFallbackServerIp, cdnBaseUrl, cdnFallback, settingsLoading, blobCacheVersion, allAvatarsReady]);

  // Detect when all avatar sources have been exhausted
  useEffect(() => {
    if (!currentSection) return;
    
    // Count how many sources were tried and failed
    const allPossibleSources: ('vimeo' | 'local' | 'default' | 'language' | 'cdn')[] = [];
    
    if (selectedLanguage) allPossibleSources.push('language');
    if (currentSection.vimeo_url && currentSection.vimeo_uploaded) allPossibleSources.push('vimeo');
    if (currentSection.avatar_video || currentSection.avatar?.video_path) allPossibleSources.push('local');
    if (currentSection.section_id !== undefined) allPossibleSources.push('default');
    if (primarySource === 'cdn_server') allPossibleSources.push('cdn');
    
    // If we have sources but all have failed
    if (allPossibleSources.length > 0 && allPossibleSources.every(s => failedSources.has(s))) {
      console.error('[AVATAR] All sources exhausted - activating timer-only mode');
      setAvatarLoadFailed(true);
    }
  }, [currentSection, failedSources, selectedLanguage, primarySource]);

  // Track watch time for completion
  useEffect(() => {
    if (!state.isPlaying || state.duration <= 0) return;
    const delta = state.currentTime - eduLastTimeRef.current;
    if (delta > 0 && delta < 5) {
      console.log(`[EduPlayer] timeupdate delta=${delta.toFixed(2)}s currentTime=${state.currentTime.toFixed(1)}s`);
      reportWatchTime(delta);
    }
    eduLastTimeRef.current = state.currentTime;
  }, [state.currentTime, state.isPlaying, state.duration, reportWatchTime]);

  // Phase 3: Early prefetch - start buffering next section when current is 50% done
  const earlyPrefetchTriggeredRef = useRef<number>(-1);
  useEffect(() => {
    if (!state.isPlaying || state.duration <= 0) return;
    const progress = state.currentTime / state.duration;
    
    if (progress >= 0.5 && earlyPrefetchTriggeredRef.current !== currentSectionIndex) {
      const nextIndex = currentSectionIndex + 1;
      if (nextIndex < sections.length && !preloadedSectionsRef.current.has(nextIndex)) {
        console.log(`[CACHE] Early prefetch: section ${nextIndex} (current at ${(progress * 100).toFixed(0)}%)`);
        preloadSection(nextIndex);
      }
      earlyPrefetchTriggeredRef.current = currentSectionIndex;
    }
  }, [state.currentTime, state.duration, state.isPlaying, currentSectionIndex, sections.length, preloadSection]);

  // Effect-based src swapping: update video src without destroying the element
  useEffect(() => {
    const video = avatarVideoElementRef.current;
    if (!video || !avatarUrl?.url) return;

    if (video.src !== avatarUrl.url) {
      console.log('[PRELOAD] Switching avatar src to:', avatarUrl.url);
      try { video.pause(); } catch {}
      try { video.currentTime = 0; } catch {}
      video.src = avatarUrl.url;
      video.load();
    }
    // Always apply current playback rate on src change
    video.playbackRate = playbackRate;
  }, [avatarUrl?.url, playbackRate]);

  // Apply playback rate whenever it changes
  useEffect(() => {
    const video = avatarVideoElementRef.current;
    if (video) {
      video.playbackRate = playbackRate;
      console.log('[SPEED] Applied playbackRate:', playbackRate);
    }
  }, [playbackRate, currentSectionIndex]);

  // Debug log avatar URL
  useEffect(() => {
    console.log('[AVATAR DEBUG]', {
      sectionId: currentSection?.section_id,
      sectionType: currentSection?.section_type,
      hasAvatarVideo: !!currentSection?.avatar_video,
      avatarVideoValue: currentSection?.avatar_video,
      hasAvatarPath: !!currentSection?.avatar?.video_path,
      computedUrl: avatarUrl?.url,
      currentSource: avatarUrl?.source,
      selectedLanguage,
      availableLanguages,
      failedSources: Array.from(failedSources),
      avatarLoading,
      subjectId: subjectId ?? 'UNDEFINED',
      expectedSocial: SSLC_SOCIAL_SUBJECT_ID,
      isSocialScience: subjectId === SSLC_SOCIAL_SUBJECT_ID,
    });
  }, [currentSection, avatarUrl, selectedLanguage, availableLanguages, failedSources, avatarLoading, subjectId]);

  // SOCIAL-CHECK heartbeat: re-emit every 5s so evidence survives the log buffer flood
  useEffect(() => {
    const interval = window.setInterval(() => {
      const payload = {
        subjectId: subjectId ?? 'UNDEFINED',
        isSocialScience: subjectId === SSLC_SOCIAL_SUBJECT_ID,
        sampled: keyColorSampledRef.current,
        keyColor: keyColorRef.current,
      };
      console.warn('🟢 [SOCIAL-CHECK heartbeat]', payload);
      try {
        (window as any).__socialCheckHeartbeat = { ...payload, ts: Date.now() };
      } catch {}
    }, 5000);
    return () => window.clearInterval(interval);
  }, [subjectId]);


  // Build beat video playlist from section segments
  const beatVideoPlaylist = useMemo((): BeatVideoEntry[] => {
    if (!currentSection?.narration?.segments) return [];
    
    let cumulativeTime = 0;
    const playlist = currentSection.narration.segments.map((segment, index) => {
      const startTime = cumulativeTime;
      const duration = segment.duration_seconds || 5;
      cumulativeTime += duration;
      
      const beatVideo = segment.beat_videos?.[0] || null;
      const visualLayer = segment.display_directives?.visual_layer
        || (currentSection?.section_type === 'recap' ? currentSection?.visual_layer : undefined);
      // A beat video is authoritative for the visual layer unless explicitly disabled by teach.
      const isShowPhase = visualLayer === 'show' || (!!beatVideo && visualLayer !== 'teach');
      
      return {
        segmentIndex: index,
        startTime,
        endTime: cumulativeTime,
        videoPath: beatVideo,
        isShowPhase,
      };
    });

    const withBeats = playlist.filter(p => p.isShowPhase && p.videoPath).length;
    console.log(
      `[PLAYLIST] section=${currentSectionIndex} built ${playlist.length} segments (${withBeats} with beat videos)`
    );
    try {
      console.table(
        playlist.map(p => ({
          seg: p.segmentIndex,
          start_s: Number(p.startTime.toFixed(2)),
          end_s: Number(p.endTime.toFixed(2)),
          desired_s: Number((p.endTime - p.startTime).toFixed(2)),
          show: p.isShowPhase,
          video: p.videoPath,
          visual_layer: currentSection.narration?.segments?.[p.segmentIndex]?.display_directives?.visual_layer || null,
        }))
      );
    } catch {
      /* noop */
    }
    return playlist;
  }, [currentSection, currentSectionIndex]);

  // Determine if video layer should be visible (SHOW phase) - MOVED EARLIER for dependency order
  const isVideoLayerVisible = useMemo(() => {
    if (!beatVideoPlaylist.length) return false;
    
    const currentEntry = beatVideoPlaylist.find(
      entry => state.currentTime >= entry.startTime && state.currentTime < entry.endTime
    );
    
    const visible = !!currentEntry?.isShowPhase && !!currentEntry.videoPath;
    if (!visible && currentEntry?.videoPath) {
      console.warn('[BEAT STATE]', {
        section: currentSectionIndex,
        segment: currentEntry.segmentIndex,
        playerTime: state.currentTime.toFixed(2),
        start: currentEntry.startTime.toFixed(2),
        end: currentEntry.endTime.toFixed(2),
        beatVideo: currentEntry.videoPath,
        reason: 'current-entry-has-video-but-isShowPhase-false',
      });
    }
    return visible;
  }, [beatVideoPlaylist, state.currentTime]);

  // Update content video source based on current time and SHOW phase
  // Also compute segment offset for sync
  const [currentSegmentOffset, setCurrentSegmentOffset] = useState(0);
  const [currentSegmentMaxDuration, setCurrentSegmentMaxDuration] = useState(0);
  const lastPlayerTimeRef = useRef(0);

  useEffect(() => {
    if (!beatVideoPlaylist.length) return;

    const active = activeBeatEntryRef.current;
    const playerTime = state.currentTime;

    // 0) SEEK DETECTION — avatar is the master clock. If time jumped backward
    //    (or forward past a beat boundary), invalidate all sticky beat state so
    //    the overlay re-derives purely from the new avatar time.
    const prevTime = lastPlayerTimeRef.current;
    const delta = playerTime - prevTime;
    const isBackwardSeek = delta < -0.15;
    const isForwardSeek = delta > 1.0; // scrub, not natural rAF advance
    lastPlayerTimeRef.current = playerTime;

    beatEffectRunCountRef.current += 1;
    const runId = beatEffectRunCountRef.current;
    console.log('[BEAT-STRICT][EFFECT_RUN]', {
      runId,
      playerTime: playerTime.toFixed(3),
      prevTime: prevTime.toFixed(3),
      delta: delta.toFixed(3),
      isBackwardSeek,
      isForwardSeek,
      activeSegment: active?.segmentIndex,
      isPlaying: state.isPlaying,
    });


    if (isBackwardSeek) {
      // Any completed segment whose window is NOT entirely in the past must be
      // eligible to re-attach — this includes segments whose window CONTAINS
      // the new player time (the black-screen-on-backward-scrub case).
      const completed = completedBeatSegmentsRef.current;
      const beforeSize = completed.size;
      const cleared: number[] = [];
      for (const segIdx of Array.from(completed)) {
        const entry = beatVideoPlaylist.find(e => e.segmentIndex === segIdx);
        if (!entry || entry.endTime > playerTime + 0.05) {
          completed.delete(segIdx);
          cleared.push(segIdx);
        }
      }
      console.log(`[SEEK] dir=back from=${prevTime.toFixed(2)}s to=${playerTime.toFixed(2)}s completedBefore=${beforeSize} clearedCompleted=[${cleared.join(',')}]`);
    } else if (isForwardSeek) {
      console.log(`[SEEK] dir=fwd from=${prevTime.toFixed(2)}s to=${playerTime.toFixed(2)}s`);
    }

    // 1) AUTHORITY: if a beat is currently active, keep it until ITS OWN endTime
    //    elapses — UNLESS a seek moved us OUTSIDE the active beat window, in
    //    which case invalidate immediately and fall through to reattach.
    if (active && active.sectionIndex === currentSectionIndex) {
      const outsideActiveWindow =
        playerTime < active.startTime - 0.05 || playerTime >= active.endTime;

      const textSegmentEntry = beatVideoPlaylist.find(
        e => playerTime >= e.startTime && playerTime < e.endTime
      );
      const textSegmentIndex = textSegmentEntry?.segmentIndex ?? -1;

      if (textSegmentIndex !== active.segmentIndex) {
        console.log(
          `[TEXT/BEAT SYNC] textSegment=${textSegmentIndex} activeBeatSegment=${active.segmentIndex} playerTime=${playerTime.toFixed(2)}s beatEnd=${active.endTime.toFixed(2)}s outsideWindow=${outsideActiveWindow}`
        );
      }

      if (outsideActiveWindow) {
        const reason = playerTime < active.startTime ? 'seek-back' : 'segment-exit';
        console.log(
          `[BEAT] CLEAR segment=${active.segmentIndex} reason=${reason} playerTime=${playerTime.toFixed(2)}s window=[${active.startTime.toFixed(2)},${active.endTime.toFixed(2)}]`
        );
        // Only mark as completed on natural forward exit — not on backward seek.
        if (reason === 'segment-exit') {
          completedBeatSegmentsRef.current.add(active.segmentIndex);
        }
        activeBeatEntryRef.current = null;
        setContentVideoSrc(null);
        setContentVideoReady(false);
        setCurrentSegmentOffset(0);
        setCurrentSegmentMaxDuration(0);
        // fall through so a new segment-with-beat can attach immediately
      } else {
        // Beat still within its window — allow swap only if the new text segment
        // has its own different beat video. Otherwise keep current beat but
        // KEEP THE UNDERLYING <video> ELEMENT IN SYNC on scrubs.
        const isDifferentBeat =
          textSegmentEntry &&
          textSegmentEntry.isShowPhase &&
          textSegmentEntry.videoPath &&
          textSegmentEntry.segmentIndex !== active.segmentIndex;
        if (!isDifferentBeat) {
          // Re-align beat <video>.currentTime to (playerTime - active.startTime)
          // when the avatar has scrubbed within the same beat window.
          // Route through the seek token — never write currentTime here directly.
          if (isBackwardSeek || isForwardSeek) {
            const desiredOffset = Math.max(0, playerTime - active.startTime);
            console.log('[BEAT-STRICT][DECISION]', {
              branch: 'reseek-beat-same-window',
              segment: active.segmentIndex,
              desiredOffset: desiredOffset.toFixed(3),
              isPlaying: state.isPlaying,
              runId,
            });
            setCurrentSegmentOffset(desiredOffset);
            setBeatSeekToken(t => t + 1);
          }
          return;
        }
      }
    }


    const currentEntry = beatVideoPlaylist.find(
      entry => playerTime >= entry.startTime && playerTime < entry.endTime
    );

    if (!currentEntry && contentVideoSrc) {
      const a = activeBeatEntryRef.current;
      console.log(
        `[BEAT] CLEAR reason=out-of-segment segment=${a?.segmentIndex ?? 'unknown'} playerTime=${playerTime.toFixed(2)}s`
      );
      setContentVideoSrc(null);
      activeBeatEntryRef.current = null;
      setContentVideoReady(false);
      setCurrentSegmentOffset(0);
      setCurrentSegmentMaxDuration(0);
      return;
    }

    if (currentEntry?.isShowPhase && currentEntry.videoPath) {
      const desiredDur = currentEntry.endTime - currentEntry.startTime;

      if (completedBeatSegmentsRef.current.has(currentEntry.segmentIndex)) {
        if (isBackwardSeek || isForwardSeek) {
          // Force re-attach after a seek — never honor stale completion.
          completedBeatSegmentsRef.current.delete(currentEntry.segmentIndex);
          console.log(
            `[SEEK] reattach-after-clear segment=${currentEntry.segmentIndex} offset=${Math.max(0, playerTime - currentEntry.startTime).toFixed(2)}s`
          );
        } else {
          return;
        }
      }

      let videoUrl: string;
      if (primarySource === 'vimeo') {
        const vimeoBeatUrl = getVimeoBeatVideoUrl(currentEntry.videoPath);
        if (vimeoBeatUrl) {
          videoUrl = vimeoBeatUrl;
        } else {
          const videoPath = resolveMediaPath(currentEntry.videoPath, 'video');
          videoUrl = getCdnMediaUrl(jobId, videoPath, cdnBaseUrl);
        }
      } else if (primarySource === 'cdn_server') {
        const videoPath = resolveMediaPath(currentEntry.videoPath, 'video');
        videoUrl = getCdnMediaUrl(jobId, videoPath, cdnBaseUrl);
      } else {
        const videoPath = resolveMediaPath(currentEntry.videoPath, 'video');
        videoUrl = getAdminMediaUrl(jobId, videoPath, effectiveLocalServerIp);
      }

      const a = activeBeatEntryRef.current;
      const segmentChanged = a?.sectionIndex !== currentSectionIndex || a?.segmentIndex !== currentEntry.segmentIndex;

      if (videoUrl !== contentVideoSrc || segmentChanged) {
        const offset = Math.max(0, playerTime - currentEntry.startTime);
        const blobUrl = preloadedBeatBlobUrlsRef.current.get(videoUrl) || null;
        const playUrl = blobUrl || videoUrl;
        const srcKind = blobUrl ? 'BLOB' : 'PROXY';
        console.log(
          `[BEAT] ENTER segment=${currentEntry.segmentIndex} src=${srcKind} playerTime=${playerTime.toFixed(2)}s start=${currentEntry.startTime.toFixed(2)}s end=${currentEntry.endTime.toFixed(2)}s desiredTime=${desiredDur.toFixed(2)}s offset=${offset.toFixed(2)}s file=${currentEntry.videoPath} url=${playUrl.slice(0, 80)}`
        );
        activeBeatEntryRef.current = {
          sectionIndex: currentSectionIndex,
          segmentIndex: currentEntry.segmentIndex,
          startTime: currentEntry.startTime,
          endTime: currentEntry.endTime,
          desiredDur,
          videoPath: currentEntry.videoPath,
          videoUrl: playUrl,
          enteredAtPlayerTime: playerTime,
          // Backdate wall time so elapsedSinceAttach matches the beat offset
          // (prevents misleading [VideoLayer BOUNDARY] on mid-beat re-attach).
          enteredAtWallTime: performance.now() - offset * 1000,
        };
        setContentVideoReady(playUrl === contentVideoSrc);
        setCurrentSegmentOffset(offset);
        setCurrentSegmentMaxDuration(desiredDur);
        setContentVideoSrc(playUrl);

        // Bump the seek token so VideoLayer performs a single, well-defined
        // seek-to-offset once the new src attaches. We no longer touch
        // vid.currentTime from here — that caused a repeated seek loop when
        // this effect re-ran on natural playback ticks.
        console.log('[BEAT-STRICT][DECISION]', {
          branch: 'reattach-new-src',
          segment: currentEntry.segmentIndex,
          offset: offset.toFixed(3),
          isPlaying: state.isPlaying,
          runId,
          reason: videoUrl !== contentVideoSrc ? 'src-change' : 'segment-change',
        });
        setBeatSeekToken(t => t + 1);

      } else if (isBackwardSeek || isForwardSeek) {
        // Same src, same segment — avatar scrubbed within the current beat.
        const desiredOffset = Math.max(0, playerTime - currentEntry.startTime);
        console.log('[BEAT-STRICT][DECISION]', {
          branch: 'same-src-scrub',
          segment: currentEntry.segmentIndex,
          desiredOffset: desiredOffset.toFixed(3),
          isPlaying: state.isPlaying,
          runId,
        });
        setCurrentSegmentOffset(desiredOffset);
        setBeatSeekToken(t => t + 1);
      }
    }

    // NOTE: We deliberately do NOT clear contentVideoSrc when the current text segment
    // has no video — beat lifetime is owned by activeBeatEntryRef window above.
  }, [state.currentTime, beatVideoPlaylist, jobId, getMediaUrl, contentVideoSrc, primarySource, effectiveLocalServerIp, effectiveFallbackServerIp, cdnBaseUrl, currentSectionIndex, blobCacheVersion]);

  // Auto-play content video when it's set and player is playing
  useEffect(() => {
    if (contentVideoSrc && state.isPlaying && contentVideoRef.current) {
      contentVideoRef.current.play().catch(err => {
        console.warn('[VIDEO] Auto-play failed:', err);
      });
    }
  }, [contentVideoSrc, state.isPlaying]);

  // Chroma key rendering function - removes green screen (runs continuously like reference player)
  const renderChromaFrame = useCallback(() => {
    const video = avatarVideoElementRef.current;
    const canvas = canvasRef.current;
    
    // ALWAYS schedule next frame - don't check paused state (matches reference player)
    const scheduleNext = () => {
      animationFrameRef.current = requestAnimationFrame(renderChromaFrame);
    };

    // Check readyState but keep loop running
    if (!video || video.readyState < 2) {
      scheduleNext();
      return;
    }

    if (!canvas) {
      scheduleNext();
      return;
    }

    // Skip rendering if canvas not ready, but keep loop running
    if (canvas.width === 0 && canvas.height === 0) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      } else {
        scheduleNext();
        return;
      }
    }

    try {
      const renderer = glRendererRef.current;
      if (renderer && !useCPURef.current) {
        // GPU path — WebGL chroma key (full resolution, no getImageData)
        if (!chromaLoggedOnceRef.current) {
          console.log('[ChromaKey] 🎮 Rendering frame via GPU', {
            presetName: chromaParamsRef.current.presetName,
            courseId,
            subjectId,
          });
          chromaLoggedOnceRef.current = true;
        }
        renderer.renderFrame(video);
      } else {
        // CPU fallback path
        if (!chromaLoggedOnceRef.current) {
          console.log('[ChromaKey] 🖥️ Rendering frame via CPU', {
            presetName: chromaParamsRef.current.presetName,
            courseId,
            subjectId,
          });
          chromaLoggedOnceRef.current = true;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.error('[ChromaKey] ❌ Failed to get 2D context — canvas may be tainted by failed WebGL init');
          scheduleNext();
          return;
        }

        // Sync canvas size with video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const params = chromaParamsRef.current;
        processChromaKey(imageData.data, params);
        const passes = Math.max(0, params.edgeErodePasses);
        for (let p = 0; p < passes; p++) {
          erodeGreenEdges(imageData.data, canvas.width, canvas.height, params);
        }
        smoothAlphaEdges(imageData.data, canvas.width, canvas.height, params);
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (e) {
      console.error('[CHROMA] Error:', e);
    }

    // CRITICAL: Always schedule next frame
    scheduleNext();
  }, []);

  // Track previous play state to detect genuine changes
  const prevPlayingRef = useRef<boolean>(state.isPlaying);

  // Resolve per-subject chroma key tuning (old player only)
  const device: Device = isMobile ? 'mobile' : 'desktop';
  useEffect(() => {
    // CPU fallback presets (legacy HSL)
    const cpuParams = getChromaParams(courseId, subjectId);
    chromaParamsRef.current = cpuParams;
    // GPU YCbCr presets (new) — loads localStorage override if user tuned via Ctrl+D
    const glParams = getGLChromaParams(courseId, subjectId, device);
    glParamsRef.current = glParams;
    setGlParamsState(glParams);
    glRendererRef.current?.setParams(glParams);
    chromaLoggedOnceRef.current = false;
    // Force re-sample key color when subject changes
    keyColorSampledRef.current = false;
    console.info('[ChromaKey] ✅ ACTIVE_OLD_PLAYER_PRESET', {
      cpuPreset: cpuParams.presetName,
      glPreset: glParams.presetName,
      courseId, subjectId, device,
      renderPath: glRendererRef.current && !useCPURef.current ? 'gpu' : useCPURef.current ? 'cpu' : 'pending',
      glParams,
    });
  }, [courseId, subjectId, device]);

  // Callback ref: initialize WebGL the moment the canvas mounts (replaces the
  // one-shot mount effect that ran before the conditional <canvas> existed).
  const canvasCallbackRef = useCallback((el: HTMLCanvasElement | null) => {
    const previous = canvasRef.current;
    if (el === previous) return;

    // Tear down previous renderer when canvas unmounts or swaps
    if (glRendererRef.current) {
      try { glRendererRef.current.destroy(); } catch {/* ignore */}
      glRendererRef.current = null;
    }

    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
    if (!el) return;

    const renderer = initChromaKeyGL(el);
    if (renderer) {
      glRendererRef.current = renderer;
      useCPURef.current = false;
      renderer.setParams(glParamsRef.current);
      const { r, g, b } = keyColorRef.current;
      renderer.setKeyColor(r, g, b);
      setRendererReadyVersion((v) => v + 1);
      chromaLog.info('webgl.init', {
        device,
        dpr: typeof window !== 'undefined' ? window.devicePixelRatio : null,
        preset: glParamsRef.current.presetName,
        ...describeGL(renderer.gl),
      });
    } else {
      useCPURef.current = true;
      setRendererReadyVersion((v) => v + 1);
      chromaLog.warn('webgl.init.failed', { reason: 'initChromaKeyGL returned null', fallback: 'cpu' });
    }
  }, [device]);

  // Auto-detect avatar key color from first usable frame of every new avatar video
  useEffect(() => {
    const video = avatarVideoElementRef.current;
    const renderer = glRendererRef.current;
    if (!video) return;

    // Source change → reset sample lock and log it
    if (keyColorSampledRef.current) {
      chromaLog.info('source.change', {
        oldRgb: keyColorRef.current,
        reason: 'source-change',
      });
    }
    keyColorSampledRef.current = false;
    let firstAttemptLogged = false;
    let lastRejectReason: string | null = null;
    let playingTimer: number | null = null;
    let retryTimer: number | null = null;

    const doSample = (trigger: 'loadeddata' | 'canplay' | 'immediate' | 'playing+500' | 'playing+1500') => {
      if (keyColorSampledRef.current) return;
      if (video.readyState < 2 || !video.videoWidth) return;

      if (!firstAttemptLogged) {
        firstAttemptLogged = true;
        chromaLog.info('sample.first-attempt', {
          src: video.currentSrc?.slice(0, 80) || null,
          videoW: video.videoWidth,
          videoH: video.videoHeight,
          readyState: video.readyState,
        });
      }

      const isSocialScience = subjectId === SSLC_SOCIAL_SUBJECT_ID;
      const socialCheckPayload = {
        trigger,
        subjectId: subjectId ?? 'UNDEFINED',
        expected: SSLC_SOCIAL_SUBJECT_ID,
        isSocialScience,
        path: isSocialScience ? 'SOCIAL' : 'DEFAULT',
      };
      console.warn('🟢 [SOCIAL-CHECK]', socialCheckPayload);
      try {
        (window as any).__socialCheck = { ...socialCheckPayload, ts: Date.now() };
        sessionStorage.setItem('socialCheckLast', JSON.stringify({ ...socialCheckPayload, ts: Date.now() }));
      } catch {}

      if (isSocialScience) {
        chromaLog.info('sample.social-path', { trigger, subjectId });
      }
      const sampled = isSocialScience
        ? sampleAvatarGreenSocial(video)
        : sampleAvatarGreen(video);

      // confidence < 0 → exception path inside sampler
      if (sampled.confidence < 0) {
        chromaLog.error('sample.threw', { trigger, reason: sampled.rejectReason ?? 'unknown' });
        return;
      }
      // Rejection: low corner agreement / low green ratio / high spread.
      // Do NOT push color or auto-tune — keep current key color/params.
      if (sampled.confidence === 0 || (sampled.greenRatio ?? 0) < 0.55) {
        lastRejectReason = sampled.rejectReason ?? `greenRatio ${(sampled.greenRatio ?? 0).toFixed(2)}`;
        chromaLog.warn('sample.rejected', {
          trigger,
          reason: lastRejectReason,
          rgb: { r: sampled.r, g: sampled.g, b: sampled.b },
          hex: sampled.hex,
          luma: sampled.luma ?? null,
          sat: sampled.sat ?? null,
          greenDominance: sampled.greenDominance ?? null,
          strategy: sampled.strategy ?? null,
          greenRatio: sampled.greenRatio != null ? +sampled.greenRatio.toFixed(3) : null,
          cornersUsed: sampled.cornersUsed ?? 0,
          spreadG: sampled.spread?.g ?? null,
          keptKeyColor: keyColorRef.current,
          keptPreset: glParamsRef.current.presetName,
        });
        setDetectedSample((prev) => ({
          ...prev,
          status: 'rejected',
          rejectReason: lastRejectReason ?? undefined,
          trigger,
          sampledAt: Date.now(),
        }));
        return;
      }

      // Accepted — push detected color to both GPU and CPU paths.
      keyColorRef.current = { r: sampled.r, g: sampled.g, b: sampled.b };
      renderer?.setKeyColor(sampled.r, sampled.g, sampled.b);
      setKeyColorState({ r: sampled.r, g: sampled.g, b: sampled.b });
      keyColorSampledRef.current = true;

      const presetParams = glParamsRef.current;
      const tuned = isSocialScience
        ? autoTuneFromSocialSample(sampled, presetParams)
        : autoTuneFromSample(sampled, presetParams);
      const tunedFeather = (tuned as { feather?: number }).feather;
      const nextGl: GLChromaParams = {
        ...presetParams,
        similarity: tuned.similarity,
        smoothness: tuned.smoothness,
        spill: tuned.spill,
        // Social-Science path widens feather to kill the pixelated rim;
        // all other subjects keep their preset feather unchanged.
        feather: isSocialScience && typeof tunedFeather === 'number'
          ? tunedFeather
          : presetParams.feather,
        presetName: presetParams.presetName.endsWith('-auto')
          ? presetParams.presetName
          : `${presetParams.presetName}-auto`,
      };
      const tunedPayload = {
        path: isSocialScience ? 'SOCIAL' : 'DEFAULT',
        subjectId: subjectId ?? 'UNDEFINED',
        similarity: nextGl.similarity,
        smoothness: nextGl.smoothness,
        spill: nextGl.spill,
        feather: nextGl.feather,
        presetName: nextGl.presetName,
      };
      console.warn('🟢 [SOCIAL-CHECK] tuned', tunedPayload);
      try {
        (window as any).__socialCheckTuned = { ...tunedPayload, ts: Date.now() };
        sessionStorage.setItem('socialCheckTuned', JSON.stringify({ ...tunedPayload, ts: Date.now() }));
      } catch {}

      const changed =
        nextGl.similarity !== presetParams.similarity ||
        nextGl.smoothness !== presetParams.smoothness ||
        nextGl.spill !== presetParams.spill ||
        nextGl.feather !== presetParams.feather;
      if (changed) {
        glParamsRef.current = nextGl;
        setGlParamsState(nextGl);
        glRendererRef.current?.setParams(nextGl);
        chromaLog.info('keying.auto-tune', {
          path: glRendererRef.current && !useCPURef.current ? 'gpu' : 'cpu',
          before: {
            similarity: presetParams.similarity,
            smoothness: presetParams.smoothness,
            spill: presetParams.spill,
          },
          after: {
            similarity: nextGl.similarity,
            smoothness: nextGl.smoothness,
            spill: nextGl.spill,
          },
          reason: tuned.reason,
        });
      }

      // CPU fallback params — always derived from same RGB + (tuned) GL params
      chromaParamsRef.current = glToCpuParams(nextGl, sampled);

      setDetectedSample({
        r: sampled.r, g: sampled.g, b: sampled.b, hex: sampled.hex,
        confidence: sampled.confidence, source: 'auto',
        trigger, sampledAt: Date.now(),
        status: 'accepted',
      });
      chromaLog.info('sample.success', {
        trigger,
        rgb: { r: sampled.r, g: sampled.g, b: sampled.b },
        hex: sampled.hex,
        confidence: +sampled.confidence.toFixed(3),
        greenRatio: sampled.greenRatio != null ? +sampled.greenRatio.toFixed(3) : null,
        cornersUsed: sampled.cornersUsed ?? null,
        sampledPixels: sampled.sampledPixels ?? null,
        greenPixels: sampled.greenPixels ?? null,
        spreadG: sampled.spread?.g ?? null,
        luma: sampled.luma ?? null,
        sat: sampled.sat ?? null,
        greenDominance: sampled.greenDominance ?? null,
        strategy: sampled.strategy ?? null,
        effectiveParams: {
          presetName: nextGl.presetName,
          similarity: nextGl.similarity,
          smoothness: nextGl.smoothness,
          spill: nextGl.spill,
          feather: nextGl.feather,
          choke: nextGl.choke,
        },
      });
      chromaLog.info('keyColor.push', {
        rgb: { r: sampled.r, g: sampled.g, b: sampled.b },
        hex: sampled.hex,
        source: 'auto',
        effectiveParams: {
          presetName: nextGl.presetName,
          similarity: nextGl.similarity,
          smoothness: nextGl.smoothness,
          spill: nextGl.spill,
          feather: nextGl.feather,
          choke: nextGl.choke,
        },
      });
    };

    const onLoaded = () => doSample('loadeddata');
    const onCanPlay = () => doSample('canplay');
    const onPlaying = () => {
      if (playingTimer == null) {
        playingTimer = window.setTimeout(() => { playingTimer = null; doSample('playing+500'); }, 500);
      }
      // Second-chance retry if the first attempt rejected (bad first frame
      // or animation still settling). Only fires if we still haven't locked.
      if (retryTimer == null) {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!keyColorSampledRef.current) doSample('playing+1500');
        }, 1500);
      }
    };

    doSample('immediate');
    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    return () => {
      if (playingTimer != null) window.clearTimeout(playingTimer);
      if (retryTimer != null) window.clearTimeout(retryTimer);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
    };
  }, [currentSection?.section_id, subjectId, avatarUrl?.url, rendererReadyVersion]);

  // Ctrl+D → toggle keying control panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setTunerOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Push tuner UI changes into BOTH GPU renderer and CPU fallback params
  const handleTunerParams = useCallback((next: GLChromaParams) => {
    const prev = glParamsRef.current;
    glParamsRef.current = next;
    setGlParamsState(next);
    glRendererRef.current?.setParams(next);
    chromaParamsRef.current = glToCpuParams(next, keyColorRef.current);
    // Log only the changed param (debug, gated)
    const changed = (['similarity','smoothness','spill','feather','choke'] as const)
      .find((k) => prev[k] !== next[k]);
    if (changed) {
      chromaLog.debug('slider.tune', { param: changed, value: next[changed], presetName: next.presetName });
    }
  }, []);
  const handleTunerKeyColor = useCallback((r: number, g: number, b: number) => {
    keyColorRef.current = { r, g, b };
    glRendererRef.current?.setKeyColor(r, g, b);
    setKeyColorState({ r, g, b });
    chromaParamsRef.current = glToCpuParams(glParamsRef.current, { r, g, b });
    keyColorSampledRef.current = true; // user override locks auto-sampling
    const hex = `#${[r,g,b].map((n) => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('')}`.toUpperCase();
    setDetectedSample({ r, g, b, hex, confidence: 1, source: 'user', sampledAt: Date.now() });
    chromaLog.info('keyColor.push', {
      rgb: { r, g, b },
      hex,
      source: 'user',
      effectiveParams: {
        presetName: glParamsRef.current.presetName,
        similarity: glParamsRef.current.similarity,
        smoothness: glParamsRef.current.smoothness,
        spill: glParamsRef.current.spill,
        feather: glParamsRef.current.feather,
        choke: glParamsRef.current.choke,
      },
    });
  }, []);




  // Effect 2: Chroma key animation loop (restarts when renderChromaFrame changes)
  useEffect(() => {
    console.log('[CHROMA] Starting continuous chroma key loop');
    animationFrameRef.current = requestAnimationFrame(renderChromaFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderChromaFrame]);

  // Sync avatar video playback - avatar provides audio, NEVER pause during SHOW phase
  useEffect(() => {
    const video = avatarVideoElementRef.current;
    const elapsed = performance.now() - sectionSwitchTimestampRef.current;
    
    console.log(`[SWITCH] Sync effect at t=${elapsed.toFixed(0)}ms`, {
      isPlaying: state.isPlaying,
      isAvatarReady: state.isAvatarReady,
      readyState: video?.readyState ?? 'no-video',
      hasError: !!video?.error,
    });
    
    if (!video) return;
    
    if (state.isPlaying) {
      // If avatar has error, don't try to play it - timer fallback handles this
      if (video.error) {
        console.log('[SYNC] Avatar has error, relying on timer fallback');
        return;
      }
      
      // Guard: only call play() if video is actually paused (prevents spam every ~250ms)
      if (video.readyState >= 2 && video.paused) {
        console.log(`[SWITCH] Sync effect calling video.play() at t=${elapsed.toFixed(0)}ms`);
        video.play().catch(err => {
          if (err.name === 'NotAllowedError') {
            console.warn('[SYNC] Autoplay blocked');
            setNeedsUserInteraction(true);
            pause();
          }
        });
      } else if (video.readyState < 2) {
        console.log(`[SWITCH] Sync effect: isPlaying but readyState=${video.readyState}, waiting...`);
      }
    } else {
      video.pause();
    }

    prevPlayingRef.current = state.isPlaying;
  }, [state.isPlaying, state.isAvatarReady, pause, currentSectionIndex]);

  // Auto-play when all avatars are ready AND pre-intro has ended
  useEffect(() => {
    if (requireTapToStart && !userHasStarted) return;
    if (allAvatarsReady && preIntroEnded && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      console.log('[AUTOPLAY] Pre-intro ended and avatars ready, starting playback');
      userWantsPlayRef.current = true;
      setTimeout(() => {
        if (isSectionReady(currentSectionIndex)) {
          play();
        } else {
          console.warn('[AUTOPLAY] Blocked until current section is blob-ready', {
            section: currentSectionIndex,
            ...getSectionCacheReport(currentSectionIndex),
          });
          setWaitingForBlobs(true);
          preloadSection(currentSectionIndex);
        }
      }, 100);
    }
  }, [allAvatarsReady, preIntroEnded, play, requireTapToStart, userHasStarted, isSectionReady, currentSectionIndex, preloadSection, getSectionCacheReport]);

  // Monitor avatar video readyState for auto-play
  useEffect(() => {
    const video = avatarVideoElementRef.current;
    const elapsed = performance.now() - sectionSwitchTimestampRef.current;
    
    console.log(`[SWITCH] Autoplay monitor at t=${elapsed.toFixed(0)}ms`, {
      pendingAutoPlay: pendingAutoPlayRef.current,
      readyState: video?.readyState ?? 'no-video',
      avatarLoading,
    });
    
    if (!pendingAutoPlayRef.current) return;
    
    // Function to check if video is ready and start playback
    const checkReadyAndPlay = () => {
      const currentVideo = avatarVideoElementRef.current;
      if (currentVideo && currentVideo.readyState >= 2 && pendingAutoPlayRef.current) {
        pendingAutoPlayRef.current = false;
        console.log('[AUTOPLAY] Video ready, starting playback for section', currentSectionIndex);
        
        prevPlayingRef.current = false;
        play();
        
        currentVideo.play().catch(err => {
          if (err.name === 'NotAllowedError') {
            console.warn('[AUTOPLAY] Blocked by browser, needs user interaction');
            setNeedsUserInteraction(true);
          } else {
            console.warn('[AUTOPLAY] Direct play failed:', err);
          }
        });
      }
    };
    
    // Check immediately in case video is already ready
    if (video && video.readyState >= 2) {
      checkReadyAndPlay();
      return;
    }
    
    // Listen for canplay event
    const handleCanPlay = () => {
      console.log('[AUTOPLAY] canplay event fired');
      checkReadyAndPlay();
    };
    
    if (video) {
      video.addEventListener('canplay', handleCanPlay);
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [currentSectionIndex, play, avatarLoading, preIntroEnded]);

  // Handle section change
  const handleSectionChange = useCallback((index: number, autoPlay: boolean = false) => {
    if (index >= 0 && index < sections.length) {
      sectionSwitchTimestampRef.current = performance.now();
      console.log(`[SWITCH] START section ${index} (autoPlay=${autoPlay}) at t=0ms`);
      const v = avatarVideoElementRef.current;
      if (v) {
        try { v.pause(); } catch {}
        try { v.currentTime = 0; } catch {}
        console.log('[AUDIO cleanup] paused + reset avatar before section swap');
      }
      reset();
      setCurrentSectionIndex(index);

      // Allow gate effect to re-evaluate for this new index.
      lastGatedSectionRef.current = null;

      // Kick off preload immediately so the user sees no dead time.
      if (!isSectionReady(index)) {
        console.log(`[SWITCH] Section ${index} not cached — preloading on demand`);
        setWaitingForBlobs(true);
        preloadSection(index);
      }

      // User intent: tapping a section implies they want it to play.
      const wantsPlay = autoPlay || (userHasStarted && (!requireTapToStart || userHasStarted));
      userWantsPlayRef.current = wantsPlay;
      pendingAutoPlayRef.current = autoPlay && (!requireTapToStart || userHasStarted);
    }
  }, [sections.length, reset, requireTapToStart, userHasStarted, isSectionReady, preloadSection]);

  const handlePrevious = useCallback(() => {
    if (currentSectionIndex > 0) handleSectionChange(currentSectionIndex - 1);
  }, [currentSectionIndex, handleSectionChange]);

  const handleNext = useCallback(() => {
    if (currentSectionIndex < sections.length - 1) handleSectionChange(currentSectionIndex + 1);
  }, [currentSectionIndex, sections.length, handleSectionChange]);

  // Toggle fullscreen with orientation lock for mobile
  const toggleFullscreen = useCallback(async () => {
    console.log('[Fullscreen] Toggle START, document.fullscreenElement:', !!document.fullscreenElement);
    console.log('[Fullscreen] fullscreenWrapperRef.current:', !!fullscreenWrapperRef.current);
    if (!fullscreenWrapperRef.current) {
      console.warn('[Fullscreen] No wrapper ref, aborting');
      return;
    }
    if (!document.fullscreenElement) {
      try {
        console.log('[Fullscreen] Calling requestFullscreen...');
        await fullscreenWrapperRef.current.requestFullscreen();
        console.log('[Fullscreen] requestFullscreen SUCCESS');
        isFullscreenRef.current = true;
      } catch (err) {
        console.error('[Fullscreen] requestFullscreen FAILED:', err);
        return;
      }
      try {
        if (screen?.orientation?.lock) {
          console.log('[Fullscreen] Calling orientation.lock(landscape)...');
          await screen.orientation.lock('landscape');
          console.log('[Fullscreen] orientation.lock SUCCESS');
        }
      } catch (err) {
        console.warn('[Fullscreen] orientation.lock failed (CSS fallback):', err);
      }
    } else {
      console.log('[Fullscreen] Exiting fullscreen...');
      try { screen?.orientation?.unlock?.(); } catch {}
      isFullscreenRef.current = false;
      document.exitFullscreen().catch(() => {});
    }
    console.log('[Fullscreen] Toggle END');
  }, []);

  // Sync fullscreen state with browser (handles system gestures, back button, etc.)
  useEffect(() => {
    const handler = () => {
      const isFs = !!document.fullscreenElement;
      console.log('[Fullscreen] Change event fired, isFs:', isFs, 'previous ref:', isFullscreenRef.current);
      isFullscreenRef.current = isFs;
      setIsFullscreen(isFs);
      if (!isFs) {
        try { screen?.orientation?.unlock?.(); } catch {}
      }
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys typed inside form controls or the chroma key tuner panel
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('[data-chroma-tuner]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) {
        return;
      }
      switch (e.key) {
        case ' ': e.preventDefault(); handleTogglePlayPause(); break;
        case 'ArrowLeft': e.ctrlKey ? handlePrevious() : seek(Math.max(0, state.currentTime - 10)); break;
        case 'ArrowRight': e.ctrlKey ? handleNext() : seek(Math.min(totalDuration, state.currentTime + 10)); break;
        case 'f': toggleFullscreen(); break;
        case 'Escape':
          console.log('[Fullscreen] Escape pressed, isFullscreenRef:', isFullscreenRef.current);
          if (isFullscreenRef.current) {
            document.exitFullscreen().catch(() => {});
          } else {
            console.log('[Player] Escape closing player (not fullscreen)');
            console.trace('[Player] onClose trace from Escape');
            onClose?.();
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlayPause, handlePrevious, handleNext, seek, state.currentTime, totalDuration, toggleFullscreen, onClose]);

  // Note: isVideoLayerVisible is now computed earlier (line ~165) for proper dependency order

  // Determine stage mode
  const getStageMode = () => {
    if (!currentSection) return 'content';
    if (currentSection.section_type === 'intro') return 'intro';
    if (currentSection.section_type === 'recap' && isVideoLayerVisible) return 'recap';
    return currentSection.section_type as any;
  };

  // Determine which server IP to use for media in sections (or CDN base URL)
  const sectionServerIp = primarySource === 'local_server' ? effectiveLocalServerIp 
    : primarySource === 'language_priority' ? effectiveLanguageServerIp 
    : primarySource === 'cdn_server' ? null  // CDN doesn't use server IP
    : effectiveFallbackServerIp;
  
  // CDN base URL only passed when primarySource is cdn_server
  const sectionCdnBaseUrl = primarySource === 'cdn_server' ? cdnBaseUrl : null;

  // Render section content
  const renderSection = () => {
    if (!currentSection) return <div className="flex items-center justify-center h-full opacity-50">No content</div>;

    const commonProps = {
      section: currentSection,
      revealedIndices: state.revealedBeatIndices,
      jobId,
      serverIp: sectionServerIp || fallbackServerIp,
      cdnBaseUrl: sectionCdnBaseUrl,
      currentSegmentIndex: state.currentSegmentIndex,
      currentTime: state.currentTime,
      totalDuration,
      isVideoLayerVisible,
      isMobile,
    };

    switch (currentSection.section_type) {
      case 'intro':
        return <IntroSection section={currentSection} presentationTitle={presentationData.presentation_title} jobId={jobId} serverIp={sectionServerIp || fallbackServerIp} cdnBaseUrl={sectionCdnBaseUrl} />;
      case 'summary':
        return <SummarySection {...commonProps} />;
      case 'content':
      case 'example':
        return <ContentSection {...commonProps} />;
      case 'memory':
        return <MemorySection section={currentSection} revealedIndices={state.revealedBeatIndices} currentTime={state.currentTime} totalDuration={totalDuration} isMobile={isMobile} />;
      case 'quiz':
        return <QuizSection {...commonProps} />;
      case 'recap':
        return <RecapSection {...commonProps} />;
      default:
        return <ContentSection {...commonProps} />;
    }
  };

  // Handle pre-intro end (skip or video finish) - MUST be before early returns
  const handlePreIntroEnd = useCallback(() => {
    setShowPreIntro(false);
    setPreIntroEnded(true);
    console.log('[PRE-INTRO] Ended, transitioning to first section');
    
    // Trigger auto-play for the first section
    pendingAutoPlayRef.current = true;
    
    // Force play after a short delay to ensure state has updated
    setTimeout(() => {
      const video = avatarVideoElementRef.current;
      if (video && video.readyState >= 2) {
        console.log('[PRE-INTRO] Forcing video playback');
        prevPlayingRef.current = false;
        userWantsPlayRef.current = true;
        if (isSectionReady(currentSectionIndex)) {
          play();
          video.play().catch(err => {
            console.warn('[PRE-INTRO] Auto-play blocked:', err);
            setNeedsUserInteraction(true);
          });
        } else {
          console.warn('[PRE-INTRO] Force-play blocked until current section is blob-ready', {
            section: currentSectionIndex,
            ...getSectionCacheReport(currentSectionIndex),
          });
          setWaitingForBlobs(true);
          preloadSection(currentSectionIndex);
        }
      }
    }, 150);
  }, [play, isSectionReady, currentSectionIndex, preloadSection, getSectionCacheReport]);

  // Mobile: no fullscreen lock, player renders inline in portrait

  if (!presentationData || !sections.length) {
    return <div className={cn("player-stage flex items-center justify-center", className)}><p className="opacity-50">No presentation data</p></div>;
  }

  // Show loading screen until all avatars are preloaded
  if (!allAvatarsReady && !isSectionReady(currentSectionIndex)) {
    return (
      <div className={cn("flex flex-col h-full w-full overflow-hidden", className)}>
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors z-10"
              aria-label="Cancel"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          )}
          <div className="text-center w-64">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-foreground font-medium mb-2">Preparing lecture...</p>
            <Progress value={cacheProgress.total > 0 ? (cacheProgress.loaded / cacheProgress.total) * 100 : 0} className="h-2 mb-2" />
            <p className="text-muted-foreground text-sm">{cacheProgress.loaded} of {cacheProgress.total} sections cached</p>
          </div>
        </div>
        {avatarUnavailableDialog && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-background text-foreground rounded-lg shadow-xl max-w-md w-[90%] p-6 space-y-4">
              <h3 className="text-lg font-semibold">Avatar video unavailable</h3>
              <p className="text-sm text-muted-foreground">
                The teacher avatar for this lecture could not be loaded from the server (server1.simplelecture.com).
                You can continue watching — the slides and narration will still play normally.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setAvatarUnavailableDialog(false);
                    onClose?.();
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setAvatarUnavailableDialog(false);
                    setAvatarLoadFailed(true);
                    forceTimerMode();
                  }}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
                >
                  Continue without avatar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={fullscreenWrapperRef}
      className={cn("player-theme edu-player-root flex flex-col h-full w-full overflow-hidden", className)}
      data-chrome-visible={chromeVisible ? "true" : "false"}
      onClick={handleRootClick}
      onPointerMove={handleRootPointerMove}
    >

      {/* Mid-playback buffering overlay removed per request */}


      {/* Pre-Intro Video Overlay - Desktop only (mobile renders inside Stage) */}
      {!isMobile && showPreIntro && !preIntroEnded && (
        <div className="pre-intro-overlay">
          <video
            ref={preIntroVideoRef}
            autoPlay
            playsInline
            onEnded={handlePreIntroEnd}
            src="/media/pre-intro.mp4"
            className="pre-intro-video"
          />
          <button 
            className="skip-intro-button"
            onClick={handlePreIntroEnd}
          >
            Skip Intro
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar - Hidden on mobile during pre-intro */}
      <div className="player-header" style={isMobile && showPreIntro && !preIntroEnded ? { display: 'none' } : undefined}>
        <span className="player-header-logo">📚 SimpleLectures</span>
        <span className="player-header-title">{presentationData.presentation_title}</span>
        <div className="player-header-actions">
          <V4Notes
            notesId={jobId}
            subjectId={subjectId}
            chapterId={chapterId}
            topicId={topicId}
            onVisibilityChange={setNotesOpen}
          />
          <Badge className={cn("text-xs", getSectionTypeColor(currentSection?.section_type || ''))}>
            {currentSection?.section_type || 'unknown'}
          </Badge>
          {onClose && (
            <button 
              onClick={() => {
                console.log('[Player] X button clicked');
                console.trace('[Player] onClose trace from X button');
                onClose();
              }}
              className="control-button close-button"
              aria-label="Close player"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stage */}
      <Stage ref={containerRef} mode={getStageMode()} className="flex-1">
        {/* Pre-Intro Video Overlay - Mobile only (inside Stage) */}
        {isMobile && showPreIntro && !preIntroEnded && (
          <div className="pre-intro-overlay">
            <video
              ref={preIntroVideoRef}
              autoPlay
              playsInline
              onEnded={handlePreIntroEnd}
              src="/media/pre-intro.mp4"
              className="pre-intro-video"
            />
            <button 
              className="skip-intro-button"
              onClick={handlePreIntroEnd}
            >
              Skip Intro
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Layer */}
        <ContentLayer isHidden={currentSection?.section_type === 'intro'}>
          {renderSection()}
        </ContentLayer>

        {/* User Interaction Prompt for Autoplay */}
        {needsUserInteraction && (
          <div 
            className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
            onClick={() => {
              setNeedsUserInteraction(false);
              play();
            }}
          >
            <div className="text-center text-white">
              <Play className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Click to Start</h3>
              <p className="text-muted-foreground">
                Browser requires interaction to play media with audio
              </p>
            </div>
          </div>
        )}

        {/* Avatar Unavailable Dialog (server1.simplelecture.com 404) */}
        {avatarUnavailableDialog && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-background text-foreground rounded-lg shadow-xl max-w-md w-[90%] p-6 space-y-4">
              <h3 className="text-lg font-semibold">Avatar video unavailable</h3>
              <p className="text-sm text-muted-foreground">
                The teacher avatar for this lecture could not be loaded from the server (server1.simplelecture.com).
                You can continue watching — the slides and narration will still play normally.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setAvatarUnavailableDialog(false);
                    onClose?.();
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setAvatarUnavailableDialog(false);
                    setAvatarLoadFailed(true);
                  }}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
                >
                  Continue without avatar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Avatar Load Failed Warning Banner */}
        {avatarLoadFailed && (
          <div className="absolute top-16 left-4 right-4 z-40 bg-warning text-warning-foreground px-4 py-2 rounded-lg text-sm flex items-center justify-between">
            <span>⚠️ Avatar video unavailable. Running in presentation-only mode.</span>
            <button 
              onClick={() => setAvatarLoadFailed(false)}
              className="ml-4 opacity-70 hover:opacity-100 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Avatar Layer with Chroma Key */}
        <div className={cn(
          "avatar-layer",
          currentSection?.section_type === 'intro' && "mode-intro",
          avatarLoadFailed && "avatar-hidden"
        )}>
        {!avatarLoadFailed && avatarUrl?.url && (
            <div className="avatar-canvas-container">
              {/* Hidden video element - source for chroma key */}
              <video
                ref={(el) => {
                  const previousEl = avatarVideoElementRef.current;
                  avatarVideoElementRef.current = el;
                  
                  if (el !== previousEl) {
                    setAvatarVideoRef(el);
                  }
                  
                  // When video element first mounts, set src immediately
                  // (the effect may have already run and skipped because el was null)
                  if (el && avatarUrl?.url && el.src !== avatarUrl.url) {
                    console.log('[PRELOAD] Setting initial src on mount:', avatarUrl.url.substring(0, 60));
                    el.src = avatarUrl.url;
                    el.load();
                  }
                }}
                crossOrigin={avatarUrl?.url?.startsWith('blob:') ? undefined : "anonymous"}
                className="avatar-video-source"
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                playsInline
                preload="auto"
                onLoadStart={() => {
                  const elapsed = performance.now() - sectionSwitchTimestampRef.current;
                  console.log(`[SWITCH] Video load started at t=${elapsed.toFixed(0)}ms, source:`, avatarUrl.source);
                  setAvatarLoading(true);
                }}
                onLoadedMetadata={() => {
                  const elapsed = performance.now() - sectionSwitchTimestampRef.current;
                  console.log(`[SWITCH] Metadata loaded at t=${elapsed.toFixed(0)}ms, source:`, avatarUrl.source);
                }}
                onCanPlay={() => {
                  const elapsed = performance.now() - sectionSwitchTimestampRef.current;
                  const wasCached = preloadedSectionsRef.current.has(currentSectionIndex);
                  console.log(`[SWITCH] Avatar canplay at t=${elapsed.toFixed(0)}ms, cached=${wasCached}, source:`, avatarUrl.source);
                  setAvatarLoading(false);
                  setAvatarBuffering(false);
                  // Continuous loop handles chroma key - no need for first frame draw
                }}
                onWaiting={() => {
                  console.log('[AVATAR] Buffering (onWaiting)');
                  setAvatarBuffering(true);
                }}
                onPlaying={() => {
                  setAvatarBuffering(false);
                }}
                onError={(e) => {
                  const videoElement = e.target as HTMLVideoElement;
                  const erroredUrl = videoElement.src;
                  
                  // Only mark as failed if error is for CURRENT avatar URL
                  // This prevents stale errors from old videos marking new sources as failed
                  if (erroredUrl === avatarUrl.url) {
                    console.error('[AVATAR] Video error for source:', avatarUrl.source, 'url:', erroredUrl);
                    setFailedSources(prev => new Set([...prev, avatarUrl.source]));
                  } else {
                    console.warn('[AVATAR] Ignoring stale error for old URL:', erroredUrl);
                  }
                  setAvatarLoading(false);
                }}
                onPlay={() => console.log('[AVATAR] Playing - source:', avatarUrl.source)}
                onPause={() => console.log('[AVATAR] Paused')}
              />
              
              {/* Canvas for chroma-keyed output */}
              <canvas
                ref={canvasCallbackRef}
                className={`avatar-canvas${subjectId === SSLC_SOCIAL_SUBJECT_ID ? ' avatar-canvas--social-aa' : ''}`}
              />

            </div>
          )}
        </div>

        {/* Video Layer - Manim/Content Videos */}
        <VideoLayer 
          isVisible={isVideoLayerVisible && contentVideoReady}
          videoSrc={contentVideoSrc}
          preloadedVideoElement={null}
          isFullscreen={currentSection?.section_type === 'recap'}
          isPlaying={state.isPlaying}
          videoRef={contentVideoRef}
          segmentStartOffset={currentSegmentOffset}
          segmentMaxDuration={currentSegmentMaxDuration}
          beatSeekToken={beatSeekToken}
          onEnded={() => {
            const active = activeBeatEntryRef.current;
            const early = !!active && state.currentTime + 0.05 < active.endTime;
            console.warn(
              `[BEAT] IGNORE_LAYER_ENDED segment=${active?.segmentIndex ?? 'unknown'} playerTime=${state.currentTime.toFixed(2)}s expectedEnd=${active ? active.endTime.toFixed(2) : 'unknown'}s desiredTime=${active ? active.desiredDur.toFixed(2) : 'unknown'}s EARLY=${early}`
            );
          }}
          onCanPlay={() => {
            console.log('[VIDEO] Content video ready:', contentVideoSrc);
            setContentVideoReady(true);
          }}
        />

        {/* Tap-to-start overlay — premium themed design. No auto-play, no scroll-unmute. */}
        {requireTapToStart && !userHasStarted && (
          <button
            type="button"
            onClick={() => {
              const v = avatarVideoElementRef.current;
              if (v) {
                v.muted = false;
                v.volume = 1;
              }
              setUserHasStarted(true);
              setTimeout(() => {
                play();
                const vv = avatarVideoElementRef.current;
                if (vv) {
                  vv.play().catch((err) => {
                    console.warn('[TAP-TO-START] play() rejected:', err);
                  });
                }
              }, 0);
            }}
            disabled={avatarLoading}
            aria-label="Play lecture"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center group cursor-pointer"
            style={{
              background:
                'radial-gradient(ellipse at center, hsl(var(--background) / 0.15) 0%, hsl(var(--background) / 0.55) 70%, hsl(var(--background) / 0.75) 100%)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <span className="relative flex items-center justify-center">
              {/* Outer pulsing glow rings */}
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-40"
                style={{
                  background:
                    'radial-gradient(circle, hsl(var(--primary) / 0.6) 0%, transparent 70%)',
                  width: '6rem',
                  height: '6rem',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              <span
                className="absolute rounded-full opacity-60"
                style={{
                  width: '7rem',
                  height: '7rem',
                  background:
                    'conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--primary) / 0.3), hsl(var(--primary)))',
                  filter: 'blur(8px)',
                }}
              />
              {/* Glassmorphism button */}
              <span
                className="relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 group-hover:scale-110 group-active:scale-95"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)',
                  boxShadow:
                    '0 20px 60px -10px hsl(var(--primary) / 0.6), 0 0 0 1px hsl(var(--primary-foreground) / 0.2) inset, 0 0 40px hsl(var(--primary) / 0.4)',
                }}
              >
                {avatarLoading ? (
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'hsl(var(--primary-foreground))' }} />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-11 h-11 ml-1 drop-shadow-lg"
                    fill="currentColor"
                    style={{ color: 'hsl(var(--primary-foreground))' }}
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </span>
            </span>
            <span
              className="mt-6 text-sm font-medium tracking-wide uppercase opacity-90 group-hover:opacity-100 transition-opacity"
              style={{
                color: 'hsl(var(--foreground))',
                textShadow: '0 2px 12px hsl(var(--background) / 0.8)',
                letterSpacing: '0.15em',
              }}
            >
              {avatarLoading ? 'Preparing lecture…' : 'Tap to play lecture'}
            </span>
          </button>
        )}

        {/* Section loading spinner — YouTube-style: transparent, centered white spinner */}
        {userHasStarted && waitingForBlobs && !isSectionReady(currentSectionIndex) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-12 h-12 animate-spin text-white" strokeWidth={2} />
          </div>
        )}



        {/* Controls - Hidden during pre-intro video */}
        {(!showPreIntro || preIntroEnded) && (
          <PlayerControls
            isPlaying={state.isPlaying}
            currentTime={state.currentTime}
            duration={state.duration || totalDuration}
            onPlayPause={handleTogglePlayPause}
            onSeek={seek}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={currentSectionIndex > 0}
            hasNext={currentSectionIndex < sections.length - 1}
            isFullscreen={isFullscreen}
            onToggleFullscreen={hideFullscreenButton ? undefined : toggleFullscreen}
            audioRef={avatarVideoElementRef}
            playbackRate={playbackRate}
            forceMobileLayout={forceMobileLayout}
            sectionPicker={hideSectionPicker ? undefined : (
              <SectionPicker 
                sections={sections} 
                currentIndex={currentSectionIndex} 
                onSectionChange={handleSectionChange}
                container={isFullscreen ? fullscreenWrapperRef.current : undefined}
                compact={isMobile}
              />
            )}
            languagePicker={
              <LanguagePicker
                availableLanguages={availableLanguages}
                currentLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                container={isFullscreen ? fullscreenWrapperRef.current : undefined}
              />
            }
          />
        )}
      </Stage>

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

      <ChromaKeyTuner
        open={tunerOpen}
        onClose={() => setTunerOpen(false)}
        courseId={courseId}
        subjectId={subjectId}
        device={device}
        params={glParamsState}
        keyColor={keyColorState}
        detected={detectedSample}
        renderPath={rendererReadyVersion === 0 ? 'pending' : (glRendererRef.current ? 'gpu' : 'cpu')}
        onParamsChange={handleTunerParams}
        onKeyColorChange={handleTunerKeyColor}
        getVideo={() => avatarVideoElementRef.current}
        container={isFullscreen ? fullscreenWrapperRef.current : undefined}
      />
    </div>
  );
};
