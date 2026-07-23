import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// useIsMobile replaced with locked useState on mount to prevent layout flips
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Mic, MicOff, Send, Loader2, ChevronLeft, ChevronRight, Play, Maximize2, Minimize2, X, Sparkles, Brain, BookOpen, Calculator, HelpCircle, MessageCircle, AlertTriangle, Database, Globe, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTeachingAssistant, TeachingResponse, PresentationSlide, DetectedTopic } from '@/hooks/useTeachingAssistant';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useGoogleTTS, clearAudioCache, SUPPORTED_LANGUAGES, SupportedLanguage, getAllCachedAudioForSlides } from '@/hooks/useGoogleTTS';
import { voiceLock } from '@/lib/voiceLock';
import { SlideAudioUrl } from '@/hooks/usePresentationAudioSaver';
import { TeacherAvatarPanel } from './TeacherAvatarPanel';
import { PresentationSlide as SlideComponent } from './PresentationSlide';
import { FloatingAvatar } from './FloatingAvatar';
import { PlaybackControls } from './PlaybackControls';
import { QuestionHistory, SlideAudioUrl as HistorySlideAudioUrl } from './QuestionHistory';
import { ParticleBackground } from './ParticleBackground';
import { ListeningAnimation } from './ListeningAnimation';
import { PreparationAnimation } from './PreparationAnimation';
import { EducationalVideoPlayerDialog } from './player/EducationalVideoPlayerDialog';
import { extractJobIdFromUrl } from './player/utils/mediaResolver';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_DIRECT_URL, SUPABASE_URL } from '@/lib/supabaseUrl';
import { useAIAssistantJob } from '@/contexts/AIAssistantJobContext';
import { QuestionSuggestionsDropdown } from './QuestionSuggestionsDropdown';


type FlowState = 'idle' | 'checking-cache' | 'thinking' | 'topic-detected' | 'preparing' | 'preparing-audio' | 'ready';

type SuggestionQuestion = {
  id: string;
  question_text: string;
};

const AI_SEARCH_BASE = 'http://116.202.230.124:8000';
const AI_SEARCH_PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;
const SLIDE_PRELOAD_AHEAD = 3;

function buildQuestionSearchUrl(query: string, subjectId?: string): string {
  const params = new URLSearchParams();
  params.set('path', '/search-questions');
  params.set('base', AI_SEARCH_BASE);
  params.set('q', query);
  if (subjectId) params.set('subject_id', subjectId);
  params.set('limit', '20');
  return `${AI_SEARCH_PROXY_URL}?${params.toString()}`;
}

function normalizeQuestionSearchResults(payload: any): SuggestionQuestion[] {
  const qaResults = Array.isArray(payload?.qa_cache_results) ? payload.qa_cache_results : [];
  return qaResults
    .map((row: any, index: number) => {
      const text = typeof row?.question === 'string' ? row.question : '';
      const id = String(row?.cache_id || row?.question_hash || `question-${index}`);
      return { id, question_text: text };
    })
    .filter((row: SuggestionQuestion) => row.question_text.trim().length > 0);
}

function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function preloadMediaElement(url: string, kind: 'audio' | 'video') {
  return new Promise<void>((resolve) => {
    const element = document.createElement(kind);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeAttribute('src');
      try {
        element.load();
      } catch {}
      resolve();
    };

    const timer = window.setTimeout(finish, 12000);
    element.preload = 'auto';
    element.src = url;
    if (kind === 'video') {
      (element as HTMLVideoElement).muted = true;
      (element as HTMLVideoElement).playsInline = true;
    }
    element.oncanplaythrough = () => {
      window.clearTimeout(timer);
      finish();
    };
    element.onloadeddata = () => {
      window.clearTimeout(timer);
      finish();
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      finish();
    };
    try {
      element.load();
    } catch {
      window.clearTimeout(timer);
      finish();
    }
  });
}

async function preloadSlideMedia(slide: any, audioUrl?: string) {
  await Promise.all([
    slide?.infographicUrl ? preloadImage(slide.infographicUrl) : Promise.resolve(),
    audioUrl || slide?.audioUrl ? preloadMediaElement(audioUrl || slide.audioUrl, 'audio') : Promise.resolve(),
    slide?.videoUrl ? preloadMediaElement(slide.videoUrl, 'video') : Promise.resolve(),
  ]);
}

interface InitialDoubtQuestion {
  questionText: string;
  correctAnswer: string;
  studentAnswer: string;
}

interface AITeachingAssistantProps {
  topicId?: string;
  chapterId?: string;
  topicTitle?: string;
  subjectName?: string;
  subjectId?: string;
  onTabActive?: () => void;
  availableLanguages?: string[] | null;
  initialDoubtQuestion?: InitialDoubtQuestion | null;
  onDoubtCleared?: () => void;
  aiPresentationJson?: any;  // Existing AI lecture for section matching
  aiGeneratedVideoUrl?: string | null;  // Video URL containing the external job ID
  isActive?: boolean;  // Whether this tab is currently active (for stopping speech when switching tabs)
  previewMode?: boolean;
  previewLimit?: number;
  previewCourseId?: string;
  onPreviewQuotaExceeded?: () => void;
  initialQuestion?: string | null;
  initialCachedResponse?: any | null;
  onInitialResponseConsumed?: () => void;
  userTier?: 'free' | 'pro';
}


// Mapping from course language names (lowercase) to TTS language codes
const COURSE_LANG_TO_TTS_CODE: Record<string, SupportedLanguage> = {
  'english': 'en-IN',
  'hindi': 'hi-IN',
  'tamil': 'ta-IN',
  'telugu': 'te-IN',
  'kannada': 'kn-IN',
  'malayalam': 'ml-IN',
  'bengali': 'bn-IN',
  'marathi': 'mr-IN',
  'gujarati': 'gu-IN',
  'punjabi': 'pa-IN',
  'odia': 'or-IN',
  'urdu': 'ur-IN',
  'assamese': 'as-IN',
};

function splitIntoSubtitleChunks(text: string): string[] {
  if (!text.trim()) return [''];
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  const wordsPerChunk = 12;
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  
  return chunks;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSlideNarrationText(slide: PresentationSlide): string {
  const keyPointText = Array.isArray(slide.keyPoints) ? slide.keyPoints.join(' ') : '';
  return (slide.narration || slide.content || keyPointText || slide.title || '').trim();
}

function shouldQueuePresentationSlide(
  slide: PresentationSlide,
  audioData?: { url?: string; durationSec?: number }
): boolean {
  // Every slide in presentationSlides must remain in the playback index space.
  // Dropping "empty" slides here causes visible jumps such as 1,2 → 5 and
  // makes the completion dialog fire while skipped slides were never shown.
  return Boolean(slide);
}

type VideoPlaybackState = {
  slideIndex: number;
  duration: number;
  currentTime: number;
  ended: boolean;
  playing: boolean;
};

type VideoSeekRequest = {
  slideIndex: number;
  time: number;
  nonce: number;
};

function extractStoredAudioList(audioData: any): any[] {
  if (!audioData) return [];
  if (Array.isArray(audioData)) return audioData;
  if (typeof audioData !== 'object') return [];

  const nested =
    audioData.urls ??
    audioData.audioUrls ??
    audioData.audio_urls ??
    audioData.slideAudioUrls ??
    audioData.slide_audio_urls ??
    audioData.items ??
    audioData.data;

  return Array.isArray(nested) ? nested : [];
}

function getStoredAudioData(response: any): any {
  const direct = response?.slideAudioUrls ?? response?.slide_audio_urls ?? response?.audioUrls ?? response?.audio_urls;
  const directList = extractStoredAudioList(direct);
  if (directList.length > 0) {
    return Array.isArray(direct) ? directList : { ...(typeof direct === 'object' ? direct : {}), urls: directList };
  }

  const slides = response?.presentationSlides ?? response?.presentation_slides;
  if (Array.isArray(slides)) {
    const fromSlides = slides
      .map((slide: any, index: number) => {
        const audioUrl = slide?.audioUrl ?? slide?.audio_url ?? slide?.audio?.url ?? slide?.audio?.audioUrl ?? slide?.audio?.audio_url;
        if (!audioUrl) return null;
        return {
          slideIndex: slide?.slideIndex ?? slide?.slide_index ?? index,
          audioUrl,
          duration: slide?.duration ?? slide?.durationSeconds ?? slide?.duration_seconds ?? 0,
        };
      })
      .filter(Boolean);
    if (fromSlides.length > 0) return fromSlides;
  }

  return null;
}

function normalizeStoredAudioUrl(url: string): string {
  if (!url) return url;
  if (url.includes('/functions/v1/b2-proxy-file')) return url;

  const b2Match = url.match(/^https?:\/\/f005\.backblazeb2\.com\/file\/[^/]+\/(.+)$/);
  if (b2Match?.[1]) {
    return `${SUPABASE_URL}/functions/v1/b2-proxy-file?path=${encodeURIComponent(b2Match[1])}`;
  }

  return url;
}

function extractMediaUrl(candidate: any): string | null {
  if (!candidate) return null;
  if (typeof candidate === 'string') return candidate.trim() || null;
  if (typeof candidate !== 'object') return null;

  const nested =
    candidate.url ??
    candidate.videoUrl ??
    candidate.video_url ??
    candidate.manimVideoUrl ??
    candidate.manim_video_url ??
    candidate.mp4Url ??
    candidate.mp4_url;

  return typeof nested === 'string' && nested.trim() ? nested : null;
}

function normalizeCachedTeachingResponse(response: any): any {
  const rawSlides = response?.presentationSlides ?? response?.presentation_slides ?? [];
  const manimMap: Record<string, any> =
    response?.manimVideoUrls || response?.manim_video_urls || {};
  const presentationSlides = Array.isArray(rawSlides)
    ? rawSlides.map((slide: any, idx: number) => {
        const videoUrl =
          extractMediaUrl(slide?.manim_video_url) ||
          extractMediaUrl(slide?.manimVideoUrl) ||
          extractMediaUrl(slide?.videoUrl) ||
          extractMediaUrl(slide?.video_url) ||
          extractMediaUrl(manimMap[idx]) ||
          extractMediaUrl(manimMap[String(idx)]);
        return {
          ...slide,
          keyPoints: slide?.keyPoints ?? slide?.key_points ?? [],
          narration: slide?.narration ?? slide?.content ?? '',
          infographicUrl: slide?.infographicUrl ?? slide?.infographic_url ?? null,
          videoUrl,
        };
      })
    : [];

  const storedAudio = getStoredAudioData(response);

  return {
    ...response,
    cached: true,
    presentationSlides,
    latexFormulas: response?.latexFormulas ?? response?.latex_formulas ?? [],
    keyPoints: response?.keyPoints ?? response?.key_points ?? [],
    slideAudioUrls: storedAudio,
  };
}

export function AITeachingAssistant({ topicId, chapterId, topicTitle, subjectName, subjectId, onTabActive, availableLanguages, initialDoubtQuestion, onDoubtCleared, aiPresentationJson, aiGeneratedVideoUrl, isActive, previewMode, previewLimit = 0, previewCourseId, onPreviewQuotaExceeded, initialQuestion, initialCachedResponse, onInitialResponseConsumed, userTier = 'pro' }: AITeachingAssistantProps) {
  const previewKey = previewCourseId ? `preview-ai-asks-${previewCourseId}` : null;
  const [previewUsed, setPreviewUsed] = useState<number>(() => {
    if (typeof window === "undefined" || !previewKey) return 0;
    return parseInt(localStorage.getItem(previewKey) || "0", 10) || 0;
  });
  const consumePreviewQuota = useCallback((): boolean => {
    if (!previewMode) return true;
    if (previewUsed >= previewLimit) {
      onPreviewQuotaExceeded?.();
      return false;
    }
    const next = previewUsed + 1;
    setPreviewUsed(next);
    if (previewKey) localStorage.setItem(previewKey, String(next));
    return true;
  }, [previewMode, previewUsed, previewLimit, previewKey, onPreviewQuotaExceeded]);
  // Lock isMobile on mount to prevent layout flips during fullscreen/orientation changes
  const [isMobile] = useState(() => window.innerWidth < 768);

  const [inputText, setInputText] = useState('');
  const [suggestionQuestions, setSuggestionQuestions] = useState<SuggestionQuestion[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [hasSearchedSuggestions, setHasSearchedSuggestions] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // Flow state for interactive confirmation
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [prevFlowState, setPrevFlowState] = useState<FlowState>('idle');
  const [animationDirection, setAnimationDirection] = useState<'none' | 'exit-left' | 'enter-right'>('none');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeInputTextarea = useCallback((ta: HTMLTextAreaElement | null) => {
    if (!ta) return;
    ta.style.height = 'auto';
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    const max = lh * 5;
    const next = Math.min(ta.scrollHeight, max);
    ta.style.height = next + 'px';
    ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
  }, []);
  useEffect(() => {
    resizeInputTextarea(inputTextareaRef.current);
  }, [inputText, resizeInputTextarea]);

  useEffect(() => {
    const query = inputText.trim();
    if (!subjectId || query.length < 2 || flowState !== 'idle') {
      setSuggestionQuestions([]);
      setIsSearchingSuggestions(false);
      setHasSearchedSuggestions(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingSuggestions(true);
    setHasSearchedSuggestions(false);
    const timeout = window.setTimeout(async () => {
      try {
        const res = await fetch(buildQuestionSearchUrl(query, subjectId), {
          method: 'GET',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setSuggestionQuestions([]);
          setHasSearchedSuggestions(true);
          return;
        }
        const payload = await res.json();
        if (controller.signal.aborted) return;
        setSuggestionQuestions(normalizeQuestionSearchResults(payload));
        setHasSearchedSuggestions(true);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.warn('[AITeachingAssistant] question suggestions failed', error);
          setSuggestionQuestions([]);
          setHasSearchedSuggestions(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingSuggestions(false);
        }
      }
    }, 80);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [inputText, subjectId, flowState]);

  const [narrationLanguage, setNarrationLanguage] = useState<SupportedLanguage>('en-IN');
  const [isLanguageSwitching, setIsLanguageSwitching] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPresentationReady, setIsPresentationReady] = useState(false);
  const [infographicPhase, setInfographicPhase] = useState<'hidden' | 'zooming' | 'zoomed' | 'returning'>('hidden');
  const [preparationStep, setPreparationStep] = useState(0);
  
  // Topic detection states
  const [detectedTopicName, setDetectedTopicName] = useState<string | null>(null);
  const [topicRelatedConcepts, setTopicRelatedConcepts] = useState<string[]>([]);
  
  // Presentation completion states
  const [isPresentationComplete, setIsPresentationComplete] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [offSubjectDialog, setOffSubjectDialog] = useState<{ open: boolean; message: string; detected?: string | null }>({ open: false, message: '', detected: null });
  const [hasResumedReview, setHasResumedReview] = useState(false);
  
  // Track playback mode: 'continuous' = full autoplay, 'single' = one slide only
  const playbackModeRef = useRef<'continuous' | 'single'>('continuous');
  const lastPlayedSlideIndexRef = useRef<number>(0);
  const videoPlaybackRef = useRef<VideoPlaybackState | null>(null);
  const [videoSeekRequest, setVideoSeekRequest] = useState<VideoSeekRequest | null>(null);
  const audioUrlBySlideRef = useRef<Map<number, string>>(new Map());
  const [readySlideIndexes, setReadySlideIndexes] = useState<Set<number>>(() => new Set());
  const preloadingSlideIndexesRef = useRef<Set<number>>(new Set());
  
  // Presentation source tracking (cached vs new)
  const [presentationSource, setPresentationSource] = useState<'new' | 'cached' | null>(null);
  
  // Audio pre-caching states
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [audioPrepareProgress, setAudioPrepareProgress] = useState({ current: 0, total: 0 });
  
  // Image pre-loading states
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [imagePrepareProgress, setImagePrepareProgress] = useState({ current: 0, total: 0 });
  
  // UI States
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  
  // Auto-hide controls state
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Avatar URL state for PlaybackControls
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // NEW: Matched lecture section states (for video player mode)
  const [matchedPresentation, setMatchedPresentation] = useState<any | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  
  const { isLoading, currentResponse, askQuestion, askDoubtQuestion, clearResponse, injectResponse } = useTeachingAssistant();
  const aiJobCtx = useAIAssistantJob();

  // Register this tab as the "active" AI surface so the global background UI
  // (pill + ready dialog) suppresses itself while the user is here. When the
  // user navigates away or switches to another tab, mark inactive so a finished
  // job surfaces the global notifier.
  useEffect(() => {
    if (isActive !== false) {
      aiJobCtx.markActive();
    } else {
      aiJobCtx.markInactive();
    }
    return () => aiJobCtx.markInactive();
  }, [isActive, aiJobCtx]);

  // Background-job awaiting confirmation: the request finished while the user
  // was somewhere else. Show an inline "Start presentation?" gate instead of
  // auto-playing.
  const pendingJob = aiJobCtx.job;
  const showStartGate =
    pendingJob &&
    pendingJob.status === 'ready' &&
    pendingJob.requiresConfirmation &&
    !pendingJob.response?.blocked;

  // Once the presentation is actually rendering, disable the "ready" nav gate.
  useEffect(() => {
    console.log('[AIGate] AITA presentation-start effect', {
      flowState,
      isPresentationReady,
      hasJob: !!aiJobCtx.job,
      presentationStarted: aiJobCtx.job?.presentationStarted,
    });
    if (flowState === 'ready' && isPresentationReady && aiJobCtx.job && !aiJobCtx.job.presentationStarted) {
      aiJobCtx.markPresentationStarted();
    }
  }, [flowState, isPresentationReady, aiJobCtx]);

  // Inject a pre-loaded cached presentation (e.g. from Solutions tab click)
  useEffect(() => {
    if (!initialQuestion || !initialCachedResponse) return;
    if (isLoading || currentResponse) return;

    // Show loading indicator immediately
    setFlowState('preparing');
    setIsPresentationReady(false);
    setInputText(initialQuestion);

    // Small delay so the loading state renders before injecting response
    const timer = setTimeout(() => {
      injectResponse(normalizeCachedTeachingResponse(initialCachedResponse));
      setFlowState('preparing-audio');
      onInitialResponseConsumed?.();
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, initialCachedResponse]);

  
  
  // Use react-speech-recognition for voice input
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();
  
  // Use Google TTS hook for audio pre-caching and playback
  
  // Compute filtered languages based on course availability
  const filteredLanguages = useMemo((): Record<string, { name: string; shortName: string; flag: string }> => {
    if (!availableLanguages || availableLanguages.length === 0) {
      // Default to English only if no languages configured
      return { 'en-IN': SUPPORTED_LANGUAGES['en-IN'] };
    }
    
    const filtered: Record<string, { name: string; shortName: string; flag: string }> = {};
    availableLanguages.forEach(lang => {
      const ttsCode = COURSE_LANG_TO_TTS_CODE[lang];
      if (ttsCode && SUPPORTED_LANGUAGES[ttsCode]) {
        filtered[ttsCode] = SUPPORTED_LANGUAGES[ttsCode];
      }
    });
    
    // Return filtered or fallback to English if nothing matched
    return Object.keys(filtered).length > 0 ? filtered : { 'en-IN': SUPPORTED_LANGUAGES['en-IN'] };
  }, [availableLanguages]);
  const { precacheAllSlides, speakFromCache, stopSpeaking: stopTTSSpeaking, isSpeaking: isTTSSpeaking } = useGoogleTTS();

  // Browser speech synthesis is intentionally disabled here; presentations must use audio URLs/files only.
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const narrationQueueRef = useRef<Array<{ 
    text: string; 
    slideIndex: number; 
    subtitleChunks: string[]; 
    hasInfographic: boolean;
    audioUrl?: string;
    audioDurationSec?: number;
  }>>([]);
  const isNarratingRef = useRef(false);
  const narrationRunIdRef = useRef(0);
  const urlAudioRef = useRef<HTMLAudioElement | null>(null); // For playing audio from stored URLs
  const isMutedRef = useRef(isMuted);
  const isPausedRef = useRef(isPaused);
  const subtitleIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preparationInFlightRef = useRef(false);
  const isCancelledRef = useRef(false);
  // One-shot: when true, the next transition into `ready` should land paused
  // on slide 0 (used when the user opens a pre-generated answer via the
  // background-job "answer ready" dialog — they expect to see, not auto-hear).
  const enterPausedRef = useRef(false);
  // One-shot guard for the gate-dialog "Watch presentation" entry path.
  // When the user returns from the navigation gate, land paused on slide 0
  // with the Play icon visible (mirrors the local "Start presentation" button).
  const gateEntryHandledRef = useRef(false);
  const forceStopListeningRef = useRef(false); // Force stop flag for speech recognition
  const [isStopping, setIsStopping] = useState(false); // Track when mic is stopping

  // Auto-hide controls after 3 seconds of inactivity
  const resetControlsTimeout = useCallback(() => {
    // Always show controls on interaction (even during zoom)
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Only schedule auto-hide when NOT zooming, NOT paused, and presentation is playing
    if (infographicPhase === 'hidden' && !isPausedRef.current) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (flowState === 'ready' && isPresentationReady) {
          setShowControls(false);
        }
      }, 3000);
    }
    // During zoom or pause, controls stay visible (no auto-hide scheduled)
  }, [flowState, isPresentationReady, infographicPhase]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Start the auto-hide timer when presentation starts
  useEffect(() => {
    if (flowState === 'ready' && isPresentationReady) {
      resetControlsTimeout();
    }
  }, [flowState, isPresentationReady, resetControlsTimeout]);

  // Gate-dialog entry path: when the user clicks "Watch presentation" in the
  // navigation gate, the AI tab activates with a pendingJob whose presentation
  // is already ready. Force paused state so the player lands on slide 0 with
  // the Play icon shown (instead of Pause icon while silent).
  useEffect(() => {
    if (
      !gateEntryHandledRef.current &&
      pendingJob &&
      isPresentationReady &&
      !enterPausedRef.current
    ) {
      console.log('[AIGate] AITA gate-entry detected → forcing paused state');
      gateEntryHandledRef.current = true;
      enterPausedRef.current = true;
      isPausedRef.current = true;
      setIsPaused(true);
    }
    // Reset guard when pendingJob clears so a future gate entry re-applies.
    if (!pendingJob && gateEntryHandledRef.current) {
      gateEntryHandledRef.current = false;
    }
  }, [pendingJob, isPresentationReady]);

  // Force controls visible during zoom, restart auto-hide when zoom ends
  useEffect(() => {
    if (infographicPhase !== 'hidden') {
      // Zoom active: show controls and cancel any pending hide
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    } else if (flowState === 'ready' && isPresentationReady && !isPausedRef.current) {
      // Zoom ended: restart auto-hide timer if playing
      resetControlsTimeout();
    }
  }, [infographicPhase, flowState, isPresentationReady, resetControlsTimeout]);

  useEffect(() => {
    onTabActive?.();
  }, [onTabActive]);

  // Fetch avatar URL based on language
  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const gender = narrationLanguage === 'hi-IN' ? 'female' : 'male';
        const { data } = await supabase
          .from('counselor_avatars')
          .select('image_url')
          .eq('gender', gender)
          .eq('is_active', true)
          .order('display_order')
          .limit(1)
          .maybeSingle();

        if (data) setAvatarUrl(data.image_url);
      } catch (error) {
        console.error('Error fetching avatar:', error);
      }
    };
    fetchAvatar();
  }, [narrationLanguage]);

  // Suppress the old browser-TTS welcome greeting. Narration must only come from real audio URLs/files.
  useEffect(() => {
    if (!hasPlayedWelcome) {
      setHasPlayedWelcome(true);
    }
  }, [hasPlayedWelcome]);

  // Handle initial doubt question from My Results tab
  useEffect(() => {
    if (initialDoubtQuestion && !isLoading && !currentResponse) {
      const { questionText, correctAnswer, studentAnswer } = initialDoubtQuestion;
      
      console.log('[AITeachingAssistant] Processing initial doubt question:', questionText.substring(0, 50));
      
      // Clear previous state
      clearResponse();
      setCurrentSlideIndex(0);
      setCurrentSubtitle('');
      setIsPresentationReady(false);
      setFlowState('thinking');
      
      // Ask the doubt question
      askDoubtQuestion(
        questionText,
        correctAnswer,
        studentAnswer,
        topicId,
        chapterId,
        subjectName,
        userTier,
      ).then(async (response) => {
        if (response && response.presentationSlides?.length > 0) {
          console.log('[AITeachingAssistant] Doubt explanation received, pre-caching audio...');
          
          // Show audio preparation state
          setFlowState('preparing-audio');
          setIsPreparingAudio(true);
          
          // Pre-cache audio for the doubt slide(s)
          try {
            const slides = response.presentationSlides.map(slide => ({
              narration: slide.narration,
              content: slide.content
            }));
            
            const audioResult = await precacheAllSlides(
              slides,
              narrationLanguage,
              'male',
              (current, total) => {
                setAudioPrepareProgress({ current, total });
              }
            );
            
            if (audioResult.totalDurationSeconds > 0) {
              setTotalTime(audioResult.totalDurationSeconds);
            }
            
            console.log('[AITeachingAssistant] Doubt audio cached successfully');
          } catch (audioError) {
            console.warn('[AITeachingAssistant] Audio caching failed, will use fallback:', audioError);
          }
          
          setIsPreparingAudio(false);
          setFlowState('ready');
          setIsPresentationReady(true);
        } else if (response) {
          // Response exists but no slides - still set ready
          setFlowState('ready');
          setIsPresentationReady(true);
        } else {
          setFlowState('idle');
        }
        // Clear the doubt question from parent
        onDoubtCleared?.();
      });
    }
  }, [initialDoubtQuestion, isLoading, currentResponse, askDoubtQuestion, topicId, chapterId, subjectName, clearResponse, onDoubtCleared, precacheAllSlides, narrationLanguage]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Update input text with transcript in real-time
  useEffect(() => {
    console.log('[Speech] Transcript updated:', transcript);
    console.log('[Speech] Listening state:', listening);
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript, listening]);

  // Show toast when microphone access is denied
  useEffect(() => {
    if (isMicrophoneAvailable === false) {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access in your browser settings.",
        variant: "destructive"
      });
    }
  }, [isMicrophoneAvailable]);

  // Robust mic stop function with multiple fallbacks
  const forceStopMic = useCallback(async (reason: string) => {
    console.log(`[Speech] forceStopMic called: ${reason}`);
    setIsStopping(true);
    forceStopListeningRef.current = true;
    
    // Method 1: abortListening (immediate)
    try {
      SpeechRecognition.abortListening();
      console.log('[Speech] abortListening called');
    } catch (e) {
      console.warn('[Speech] abortListening failed:', e);
    }
    
    // Method 2: stopListening (graceful)
    try {
      SpeechRecognition.stopListening();
      console.log('[Speech] stopListening called');
    } catch (e) {
      console.warn('[Speech] stopListening failed:', e);
    }
    
    // Method 3: Low-level browser API fallback
    try {
      const recognition = (SpeechRecognition as any).getRecognition?.();
      if (recognition) {
        recognition.abort();
        console.log('[Speech] Low-level recognition.abort() called');
      }
    } catch (e) {
      console.warn('[Speech] Low-level abort failed:', e);
    }
    
    // Release voice lock
    voiceLock.release('teaching');
    
    // Reset flags after delay
    setTimeout(() => {
      forceStopListeningRef.current = false;
      setIsStopping(false);
    }, 300);
  }, []);

  // Cleanup on mount - abort any stale speech recognition from previous sessions
  useEffect(() => {
    console.log('[Speech] Component mounted - ensuring clean state');
    forceStopMic('mount cleanup');
    
    // Register voice lock release callback
    voiceLock.onRelease('teaching', () => {
      console.log('[Speech] Voice lock released by another feature');
      forceStopMic('voice lock released');
      resetTranscript();
    });
    
    return () => {
      console.log('[Speech] Component unmounting - cleanup');
      forceStopMic('unmount cleanup');
    };
  }, [forceStopMic, resetTranscript]);

  // Safety net: Force stop listening if flag is set but state is stuck (single retry only)
  useEffect(() => {
    if (forceStopListeningRef.current && listening) {
      // Single retry after 200ms, no loop
      const timer = setTimeout(() => {
        if (forceStopListeningRef.current && listening) {
          console.log('[Speech] Safety net: Single retry to stop stuck mic');
          SpeechRecognition.abortListening();
          // Don't retry again - accept it might be stuck
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [listening]);

  // Auto-send when user stops speaking and has a transcript
  useEffect(() => {
    if (!listening && transcript.trim() && !isLoading && !currentResponse) {
      const timer = setTimeout(async () => {
        const question = transcript.trim();
        if (question) {
          if (!consumePreviewQuota()) {
            setInputText('');
            resetTranscript();
            return;
          }

          // Clear states and send the question
          setInputText('');
          resetTranscript();
          stopAllSpeech();
          clearTimers();
          clearResponse();
          setCurrentSlideIndex(0);
          setCurrentSubtitle('');
          
          // Always request English content - language selector only affects TTS voice
          const voiceResponse = await askQuestion(question, topicId, chapterId, 'en-IN', subjectName, subjectId, userTier);
          if (voiceResponse?.blocked) {
            clearResponse();
            setFlowState('idle');
            setOffSubjectDialog({
              open: true,
              message: voiceResponse.message || `This question doesn't look like it's from ${subjectName || 'this subject'}.`,
              detected: voiceResponse.detectedSubject ?? null,
            });
          }
        }
      }, 1000); // 1 second delay to let user see what was captured
      
      return () => clearTimeout(timer);
    }
  }, [listening, transcript, isLoading, currentResponse]);

  // Per-slide controller: seed totalTime from the first slide's upstream duration
  // (or 0 if not known yet). Live time/progress is driven by the active <audio>.
  useEffect(() => {
    if (currentResponse?.presentationSlides && !isPresentationReady) {
      const raw = getStoredAudioData(currentResponse) as any;
      let firstDur = 0;
      if (Array.isArray(raw) && raw.length > 0) {
        firstDur = raw[0]?.duration || 0;
      } else if (raw && Array.isArray(raw?.urls) && raw.urls.length > 0) {
        firstDur = raw.urls[0]?.duration || 0;
      }
      setTotalTime(firstDur);
      setCurrentTime(0);
      setProgress(0);
    }
  }, [currentResponse, isPresentationReady]);

  // Reset presentation ready state when loading starts
  useEffect(() => {
    if (isLoading) {
      setIsPresentationReady(false);
    }
  }, [isLoading]);

  // Combined stop function that stops TTS and URL-based audio
  const stopAllSpeech = useCallback(() => {
    narrationRunIdRef.current += 1;
    isNarratingRef.current = false;
    setIsNarrating(false);
    stopTTSSpeaking();  // Stop TTS audio
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // Also stop URL-based audio
    if (urlAudioRef.current) {
      urlAudioRef.current.pause();
      urlAudioRef.current.currentTime = 0;
      urlAudioRef.current = null;
    }
  }, [stopTTSSpeaking]);

  // Stop speech on component unmount (when user navigates away)
  useEffect(() => {
    return () => {
      console.log('[Speech] Component unmounting - stopping all speech');
      stopAllSpeech();
      clearTimers();
      narrationQueueRef.current = [];
      isNarratingRef.current = false;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopAllSpeech]);

  // Stop speech when tab becomes inactive (user switches to Videos, MCQs, etc.)
  useEffect(() => {
    if (isActive === false) {
      console.log('[Speech] Tab became inactive - stopping all speech and presentation');
      
      // Stop all audio (TTS + URL-based)
      stopAllSpeech();
      
      // Cancel browser speech synthesis directly
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      
      // Clear narration queue and timers to stop the presentation loop
      clearTimers();
      narrationQueueRef.current = [];
      isNarratingRef.current = false;
      setIsNarrating(false);
      setCurrentSubtitle('');
      
      // Reset infographic zoom
      setInfographicPhase('hidden');
      
      // Pause playback state
      setIsPaused(true);
      isPausedRef.current = true;
      
      // Stop microphone
      forceStopMic('tab inactive');
    }
  }, [isActive, stopAllSpeech, forceStopMic]);

  // Stop speech when browser tab is hidden (user minimizes or switches browser tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Speech] Browser tab hidden - stopping speech');
        stopAllSpeech();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopAllSpeech]);

  // Helper to play audio directly from a URL (for cached presentations)
  const playAudioFromUrl = useCallback((url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Stop any currently playing URL audio
      if (urlAudioRef.current) {
        urlAudioRef.current.pause();
        urlAudioRef.current = null;
      }
      
      const audio = new Audio(url);
      urlAudioRef.current = audio;

      audio.onloadedmetadata = () => {
        if (isFinite(audio.duration) && audio.duration > 0) {
          setTotalTime(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
        setCurrentTime(audio.currentTime);
        if (dur > 0) {
          setProgress(Math.min((audio.currentTime / dur) * 100, 100));
        }
      };

      audio.onended = () => {
        setProgress(100);
        urlAudioRef.current = null;
        resolve(true);
      };
      
      audio.onerror = (e) => {
        console.error('[URLAudio] Playback error:', e);
        urlAudioRef.current = null;
        resolve(false);
      };
      
      audio.play().catch((err) => {
        if (err.name === 'NotAllowedError') {
          console.warn('[URLAudio] Autoplay blocked by browser');
          toast({
            title: "Audio blocked",
            description: "Tap the play button to start audio",
            variant: "default"
          });
        } else {
          console.error('[URLAudio] Play error:', err);
        }
        urlAudioRef.current = null;
        resolve(false);
      });
    });
  }, []);

  // Preload infographic images when response arrives - with progress tracking
  const preloadImages = useCallback(async (
    slides: PresentationSlide[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    const imageUrls = slides
      .map(s => s.infographicUrl)
      .filter((url): url is string => !!url);
    
    console.log('[AITeachingAssistant] Preloading', imageUrls.length, 'images');
    
    if (imageUrls.length === 0) {
      return Promise.resolve();
    }
    
    let loaded = 0;
    const total = imageUrls.length;
    
    const loadPromises = imageUrls.map(url => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          console.log('[AITeachingAssistant] Image loaded:', loaded, '/', total);
          onProgress?.(loaded, total);
          resolve();
        };
        img.onerror = () => {
          loaded++;
          console.log('[AITeachingAssistant] Image error (still counting):', loaded, '/', total);
          onProgress?.(loaded, total);
          resolve(); // Don't block on errors
        };
        img.src = url;
      });
    });
    
    // Wait for all images or timeout after 20 seconds (increased for large base64 images)
    await Promise.race([
      Promise.all(loadPromises),
      new Promise<void>(resolve => setTimeout(resolve, 20000))
    ]);
  }, []);

  // Prepare presentation when response is received - Pre-cache ALL audio AND images first
  // If response is cached with audio URLs, skip TTS generation
  useEffect(() => {
    if (
      currentResponse?.presentationSlides &&
      currentResponse.presentationSlides.length > 0 &&
      !isPresentationReady &&
      !isPreparingAudio &&
      !isPreparingImages &&
      !preparationInFlightRef.current
    ) {
      preparationInFlightRef.current = true; // prevents duplicate runs (e.g., React StrictMode)

      console.log('[AITeachingAssistant] Response received with', currentResponse.presentationSlides.length, 'slides');
      console.log('[AITeachingAssistant] Cached response:', currentResponse.cached, 'Audio URLs:', currentResponse.slideAudioUrls?.length || 0);
      console.log('[AITeachingAssistant] Starting preparation, isMuted:', isMuted);

      const imageCount = currentResponse.presentationSlides.filter(s => s.infographicUrl).length;

      // Check if we have cached B2 audio (legacy DB format: { language, urls })
      // OR upstream per-slide audio from the new ai-teaching-assistant endpoint (flat array)
      const rawAudioData = getStoredAudioData(currentResponse) as any;
      let cachedAudioUrls: Array<{ slideIndex: number; audioUrl: string; duration: number }> | undefined;
      let cachedAudioLang: string | undefined;
      let upstreamAudioUrls: Array<{ slideIndex: number; audioUrl: string; duration: number }> | undefined;

      const rawAudioList = extractStoredAudioList(rawAudioData);

      if (rawAudioData && typeof rawAudioData === 'object' && !Array.isArray(rawAudioData)) {
        // Legacy format: { language, urls }
        cachedAudioLang = rawAudioData.language;
        cachedAudioUrls = rawAudioList;
      } else if (rawAudioList.length > 0) {
        // New upstream format: flat array of { slideIndex, audioUrl, duration } from the new endpoint.
        // These are authoritative — play them directly, never re-synthesize via TTS.
        upstreamAudioUrls = rawAudioList;
      }

      const hasCachedAudio = !!(
        cachedAudioUrls &&
        cachedAudioUrls.length > 0 &&
        (currentResponse.cached || !cachedAudioLang || cachedAudioLang === narrationLanguage)
      );
      const hasUpstreamAudio = !!(upstreamAudioUrls && upstreamAudioUrls.length > 0);

      console.log(`[AUDIO-LOAD] upstream=${upstreamAudioUrls?.length || 0}, legacy_cache=${cachedAudioUrls?.length || 0} (lang=${cachedAudioLang || 'n/a'} req=${narrationLanguage})`);
      if (hasUpstreamAudio) {
        console.log(`[AUDIO-LOAD] Using upstream slide audio (${upstreamAudioUrls!.length} urls) — TTS skipped`);
      } else if (hasCachedAudio) {
        console.log(`[AUDIO-LOAD] MATCH: Will load ${cachedAudioUrls!.length} audio files from B2 storage`);
      } else if (cachedAudioUrls && cachedAudioUrls.length > 0) {
        console.log(`[AUDIO-LOAD] MISMATCH: stored=${cachedAudioLang}, requested=${narrationLanguage} -- using fresh TTS`);
      } else {
        console.log(`[AUDIO-LOAD] NO CACHED AUDIO: generating fresh TTS`);
      }

      // Start pre-caching all audio AND images
      const preparePresentation = async () => {
        setIsPreparingAudio(true);
        setIsPreparingImages(true);
        setAudioPrepareProgress({ current: 0, total: currentResponse.presentationSlides.length });
        setImagePrepareProgress({ current: 0, total: imageCount });

        try {
          let audioResult = { success: true, totalDurationSeconds: 0 };
          let usedCachedAudio = false;
          
          if (!isMuted) {
            if (hasUpstreamAudio && upstreamAudioUrls) {
              // === UPSTREAM AUDIO: trust the URLs, do NOT call TTS, do NOT prefetch ===
              const totalDur = upstreamAudioUrls.reduce((sum, x: any) => sum + (x.duration ?? x.durationSeconds ?? x.duration_seconds ?? 0), 0);
              console.log(`[AUDIO-LOAD] Upstream audio ready: ${upstreamAudioUrls.length} slides, total ~${totalDur.toFixed(1)}s`);
              audioResult = { success: true, totalDurationSeconds: totalDur };
              usedCachedAudio = true;
              setAudioPrepareProgress({ current: upstreamAudioUrls.length, total: upstreamAudioUrls.length });
              setPresentationSource('cached');
            } else if (hasCachedAudio && cachedAudioUrls) {
              // === LOAD FROM B2 CACHE ===
              console.log(`[AUDIO-LOAD] Loading ${cachedAudioUrls.length} audio files from B2 storage...`);
              const loadStart = Date.now();
              let loadedCount = 0;
              let failedCount = 0;
              let totalDur = 0;

              for (let i = 0; i < cachedAudioUrls.length; i++) {
                const audioItem: any = cachedAudioUrls[i];
                const slideIndex = audioItem.slideIndex ?? audioItem.slide_index;
                const audioUrl = audioItem.audioUrl ?? audioItem.audio_url;
                const duration = Number(audioItem.duration ?? audioItem.durationSeconds ?? audioItem.duration_seconds ?? 0) || 0;
                if (!audioUrl) {
                  console.warn(`[AUDIO-LOAD] Slide ${slideIndex}: missing audio URL, skipping`);
                  failedCount++;
                  continue;
                }
                console.log(`[AUDIO-LOAD] Slide ${slideIndex}: Fetching from ${audioUrl.substring(0, 80)}...`);
                
                try {
                  const proxyUrl = normalizeStoredAudioUrl(audioUrl);
                  
                  const response = await fetch(proxyUrl);
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                  }
                  const blob = await response.blob();
                  console.log(`[AUDIO-LOAD] Slide ${slideIndex}: Loaded (${blob.size} bytes, ~${duration.toFixed(1)}s)`);
                  
                  // Populate in-memory audio cache so playback works normally
                  const slide = currentResponse.presentationSlides[slideIndex];
                  if (slide) {
                    const narrationText = slide.narration || slide.content || '';
                    if (narrationText.trim()) {
                      // Import the cache population mechanism
                      const cleanText = narrationText
                        .replace(/\[LANG:\w{2}-IN\]\s*/g, '')
                        .replace(/\$\$(.*?)\$\$/gs, '$1')
                        .replace(/\$(.*?)\$/g, '$1')
                        .replace(/\*\*/g, '')
                        .replace(/\*/g, '')
                        .replace(/["""''`]/g, '')
                        .replace(/[_~]/g, '')
                        .replace(/#{1,6}\s/g, '')
                        .replace(/\n+/g, '. ')
                        .trim();
                      
                      // Convert blob to base64 for cache compatibility  
                      const arrayBuffer = await blob.arrayBuffer();
                      const bytes = new Uint8Array(arrayBuffer);
                      let binary = '';
                      for (let j = 0; j < bytes.length; j++) {
                        binary += String.fromCharCode(bytes[j]);
                      }
                      const base64 = btoa(binary);
                      
                      // Use precacheAudio's cache key format to populate cache
                      // The key format is: `${lang}:${gender}:${text.substring(0, 100)}`
                      const cacheKey = `${narrationLanguage}:male:${cleanText.substring(0, 100)}`;
                      // We need to use the speak/precache mechanism - let's just call precacheAudio with a fake
                      // Actually, we'll directly use the getAudioFromCache/speakFromCache flow
                      // For now, store in a way the playback system can use
                      // The simplest approach: make the audio available through the standard cache
                    }
                  }
                  
                  loadedCount++;
                  totalDur += duration;
                  setAudioPrepareProgress({ current: i + 1, total: cachedAudioUrls.length });
                } catch (fetchErr) {
                  console.error(`[AUDIO-LOAD] Slide ${slideIndex}: FAILED to load from B2:`, fetchErr);
                  failedCount++;
                }
              }

              const loadMs = Date.now() - loadStart;
              console.log(`[AUDIO-LOAD] Loaded ${loadedCount}/${cachedAudioUrls.length} audio files from cache in ${loadMs}ms (${failedCount} failed)`);

              if (failedCount > 0 && loadedCount > 0) {
                // === PARTIAL CACHE: some slides loaded, generate TTS for missing ones ===
                const totalSlides = currentResponse.presentationSlides.length;
                const missingCount = totalSlides - loadedCount;
                console.log(`[AUDIO-LOAD] Partial cache: ${loadedCount}/${totalSlides} slides from B2, ${missingCount} need fresh TTS`);
                audioResult = { success: true, totalDurationSeconds: totalDur };
                usedCachedAudio = true; // mark as used so we don't re-save the ones we already have
                // Note: missing slides will play without audio (silent) - acceptable tradeoff
                // A future improvement could generate TTS only for missing slides
              } else if (failedCount > 0 && loadedCount === 0) {
                if (currentResponse.cached) {
                  console.warn(`[AUDIO-LOAD] All ${failedCount} cached files failed - strict audio-url mode, not generating TTS`);
                  audioResult = { success: true, totalDurationSeconds: 0 };
                  usedCachedAudio = true;
                } else {
                  console.log(`[AUDIO-LOAD] All ${failedCount} files failed - falling back to fresh TTS`);
                  // Fall through to TTS generation below for new, non-cached presentations only.
                }
              } else {
                audioResult = { success: true, totalDurationSeconds: totalDur };
                usedCachedAudio = true;
              }
            }

            if (!usedCachedAudio && currentResponse.cached) {
              console.warn('[AUDIO-LOAD] Cached presentation has no usable audio URLs - strict audio-url mode, TTS skipped');
              setAudioPrepareProgress({ current: currentResponse.presentationSlides.length, total: currentResponse.presentationSlides.length });
              audioResult = { success: true, totalDurationSeconds: 0 };
              usedCachedAudio = true;
              setPresentationSource('cached');
            }

            if (!usedCachedAudio) {
              // === GENERATE FRESH TTS ===
              console.log('[AITeachingAssistant] 🌐 Generating TTS with on-the-fly translation to', narrationLanguage);
              setPresentationSource(currentResponse.cached ? 'cached' : 'new');
              audioResult = await precacheAllSlides(
                currentResponse.presentationSlides,
                narrationLanguage,
                'male',
                (current, total) => {
                  console.log(`🔊 TTS Progress: ${current}/${total} slides cached`);
                  setAudioPrepareProgress({ current, total });
                }
              );
            }
          } else {
            setPresentationSource(currentResponse.cached ? 'cached' : 'new');
          }

          console.log('[AITeachingAssistant] Starting image pre-loading for', imageCount, 'images...');
          await preloadImages(
            currentResponse.presentationSlides,
            (current, total) => {
              setImagePrepareProgress({ current, total });
            }
          );

          // Per-slide controller now drives totalTime from the active <audio>;
          // do NOT overwrite with deck-wide sum here.

          console.log('[AITeachingAssistant] ✅ All audio AND images pre-cached!');

          // === SAVE AUDIO TO B2 (background, non-blocking) ===
          if (!isMuted && !usedCachedAudio && currentResponse.cacheId) {
            console.log(`[AUDIO-SAVE] Starting background save for cache_id=${currentResponse.cacheId}, language=${narrationLanguage}`);
            
            // Extract base64 audio data from in-memory cache
            const audioData = getAllCachedAudioForSlides(
              currentResponse.presentationSlides,
              narrationLanguage,
              'male'
            );

            if (audioData.length > 0) {
              console.log(`[AUDIO-SAVE] Found audio data for ${audioData.length} slides, sending to edge function...`);
              
              // Fire-and-forget: save in background
              supabase.functions.invoke('save-presentation-audio', {
                body: {
                  cache_id: currentResponse.cacheId,
                  slides: audioData,
                  language: narrationLanguage
                }
              }).then(({ data, error }) => {
                if (error) {
                  console.error(`[AUDIO-SAVE] ❌ Edge function error:`, error);
                } else {
                  console.log(`[AUDIO-SAVE] ✅ Edge function response: success=${data?.success}, ${data?.audioUrls?.length || 0} URLs saved, total duration: ${data?.totalDuration?.toFixed(1)}s, processing: ${data?.processingTimeMs}ms`);
                }
              }).catch(err => {
                console.error(`[AUDIO-SAVE] ❌ Failed to invoke edge function:`, err);
              });
            } else {
              console.log(`[AUDIO-SAVE] SKIPPED: No audio data extracted from cache`);
            }
          } else if (isMuted) {
            console.log(`[AUDIO-SAVE] SKIPPED: Audio is muted`);
          } else if (!currentResponse.cacheId) {
            console.log(`[AUDIO-SAVE] SKIPPED: No cacheId on response`);
          } else {
            console.log(`[AUDIO-SAVE] SKIPPED: Used cached audio from B2 (no need to re-save)`);
          }

          // Mark preparation complete - state transition will be handled by separate useEffect
          setIsPresentationReady(true);
        } catch (e) {
          console.error('[AITeachingAssistant] Preparation error:', e);
        } finally {
          setIsPreparingAudio(false);
          setIsPreparingImages(false);
          preparationInFlightRef.current = false;
        }
      };

      preparePresentation();
    }
  }, [currentResponse, preloadImages, precacheAllSlides, narrationLanguage, isMuted, isPresentationReady, isPreparingAudio, isPreparingImages]);

  // Note: Transition to preparing-audio is now handled explicitly in handleSend
  // after the preparation step animations complete

  // Transition to ready state ONLY when all preparation is complete
  useEffect(() => {
    if (
      isPresentationReady && 
      !isPreparingAudio && 
      !isPreparingImages && 
      (flowState === 'preparing' || flowState === 'preparing-audio') && 
      animationDirection === 'none'
    ) {
      console.log('[AITeachingAssistant] All content ready - starting transition to presentation');
      
      // Smooth transition: exit current animation to left, then enter ready state from right
      setPrevFlowState(flowState);
      setAnimationDirection('exit-left');
      
      const exitTimer = setTimeout(() => {
        setFlowState('ready');
        setAnimationDirection('enter-right');
        
        const enterTimer = setTimeout(() => {
          setAnimationDirection('none');
          setPrevFlowState('ready');
          console.log('[AITeachingAssistant] Transition complete - presentation visible');
        }, 400);
        
        return () => clearTimeout(enterTimer);
      }, 400);
      
      return () => clearTimeout(exitTimer);
    }
  }, [isPresentationReady, isPreparingAudio, isPreparingImages, flowState, animationDirection]);

  // Safety fallback: transition to 'ready' if stuck in preparing/preparing-audio after presentation is ready
  // This is a backup in case the main transition useEffect doesn't fire
  useEffect(() => {
    if (isPresentationReady && !isPreparingAudio && !isPreparingImages && currentResponse && (flowState === 'preparing' || flowState === 'preparing-audio')) {
      // Give the main transition useEffect time to fire first
      const timer = setTimeout(() => {
        if (flowState === 'preparing' || flowState === 'preparing-audio') {
          console.log('[AITeachingAssistant] Safety fallback: forcing transition to ready state');
          setPrevFlowState(flowState);
          setAnimationDirection('exit-left');
          
          setTimeout(() => {
            setFlowState('ready');
            setAnimationDirection('enter-right');
            
            setTimeout(() => {
              setAnimationDirection('none');
              setPrevFlowState('ready');
            }, 400);
          }, 400);
        }
      }, 1000); // Increased to 1 second to give main transition time
      return () => clearTimeout(timer);
    }
  }, [isPresentationReady, isPreparingAudio, isPreparingImages, currentResponse, flowState]);

  // Build audio URL map from cached response or replay
  const buildAudioUrlMap = useCallback((
    slideCount: number,
    audioUrls?: SlideAudioUrl[] | { urls?: SlideAudioUrl[] } | null
  ): Map<number, { url: string; durationSec: number }> => {
    const map = new Map<number, { url: string; durationSec: number }>();
    const list: any[] = extractStoredAudioList(audioUrls);

    if (list.length === 0) {
      console.log('[buildAudioUrlMap] No audio URLs provided (or not an array)');
      return map;
    }

    
    console.log('[buildAudioUrlMap] Processing', list.length, 'audio URLs');
    
    const numericIndices = list
      .map((item: any) => Number(item?.slideIndex ?? item?.slide_index))
      .filter(Number.isFinite);
    const shouldConvertOneBased =
      slideCount > 0 &&
      numericIndices.length > 0 &&
      !numericIndices.includes(0) &&
      numericIndices.every(index => index >= 1 && index <= slideCount);

    if (shouldConvertOneBased) {
      console.warn('[buildAudioUrlMap] Detected 1-based slide audio indices; converting to 0-based');
    }

    for (const [position, item] of list.entries()) {
      // Check 'duration' first (database field), then 'durationSeconds' (legacy)
      const rawItem = item as any;
      const durationSec = Number(rawItem.duration ?? rawItem.durationSeconds ?? rawItem.duration_seconds ?? 0) || 0;
      const explicitSlideIndex = Number(rawItem.slideIndex ?? rawItem.slide_index);
      const rawSlideIndex = Number.isFinite(explicitSlideIndex) ? explicitSlideIndex : position;
      const slideIndex = shouldConvertOneBased ? rawSlideIndex - 1 : rawSlideIndex;
      const rawUrl = rawItem.audioUrl ?? rawItem.audio_url ?? rawItem.url;
      const audioUrl = rawUrl ? normalizeStoredAudioUrl(rawUrl) : '';
      
      console.log(`[buildAudioUrlMap] Slide ${slideIndex}: duration=${durationSec}s, url=${audioUrl?.substring(0, 60)}...`);
      
      if (audioUrl && Number.isFinite(slideIndex) && slideIndex >= 0 && slideIndex < slideCount) {
        map.set(slideIndex, { url: audioUrl, durationSec });
      }
    }
    
    console.log('[buildAudioUrlMap] Built map with', map.size, 'entries');
    return map;
  }, []);

  // Start narration when presentation is ready AND flowState is ready AND animation is complete
  useEffect(() => {
    if (
      currentResponse?.presentationSlides && 
      !isMuted && 
      !isNarratingRef.current && 
      isPresentationReady &&
      !isPreparingAudio &&
      flowState === 'ready' &&
      animationDirection === 'none' // CRITICAL: Wait for animation to complete
    ) {
      // One-shot: arrived from the background-job "answer ready" dialog.
      // Show slide 0 in a paused state instead of auto-narrating.
      if (enterPausedRef.current) {
        console.log('[AITeachingAssistant] Entering ready paused (came from background-job dialog)');
        // Pre-build the narration queue so the user's first Play press resumes
        // exactly like a normal pause/resume from slide 0.
        const audioUrlMap = buildAudioUrlMap(
          currentResponse.presentationSlides.length,
          getStoredAudioData(currentResponse) as SlideAudioUrl[] | { urls?: SlideAudioUrl[] } | undefined
        );
        const queue: Array<{ 
          text: string; 
          slideIndex: number; 
          subtitleChunks: string[]; 
          hasInfographic: boolean;
          audioUrl?: string;
          audioDurationSec?: number;
        }> = [];
        currentResponse.presentationSlides.forEach((slide, index) => {
          const audioData = audioUrlMap.get(index);
          if (shouldQueuePresentationSlide(slide, audioData)) {
            const narrationText = getSlideNarrationText(slide);
            queue.push({ 
              text: narrationText, 
              slideIndex: index,
              subtitleChunks: splitIntoSubtitleChunks(narrationText),
              hasInfographic: !!slide.infographicUrl,
              audioUrl: audioData?.url,
              audioDurationSec: audioData?.durationSec
            });
          }
        });
        narrationQueueRef.current = queue;
        audioUrlBySlideRef.current = new Map(
          queue.filter(q => q.audioUrl).map(q => [q.slideIndex, q.audioUrl as string])
        );
        setCurrentSlideIndex(0);
        setProgress(0);
        setCurrentTime(0);
        setIsPaused(true);
        isPausedRef.current = true;
        isNarratingRef.current = false;
        enterPausedRef.current = false; // one-shot; subsequent plays behave normally
        return;
      }

      console.log('[AITeachingAssistant] Starting narration - visuals ready, animation complete');
      
      // Build audio URL map from cached response
      const audioUrlMap = buildAudioUrlMap(
        currentResponse.presentationSlides.length,
        getStoredAudioData(currentResponse) as SlideAudioUrl[] | { urls?: SlideAudioUrl[] } | undefined
      );
      const hasCachedAudioUrls = audioUrlMap.size > 0;
      console.log('[AITeachingAssistant] Cached audio URLs available:', hasCachedAudioUrls, 'count:', audioUrlMap.size);
      
      // Build queue and start immediately
      const queue: Array<{ 
        text: string; 
        slideIndex: number; 
        subtitleChunks: string[]; 
        hasInfographic: boolean;
        audioUrl?: string;
        audioDurationSec?: number;
      }> = [];
      
      currentResponse.presentationSlides.forEach((slide, index) => {
        const audioData = audioUrlMap.get(index);
        if (shouldQueuePresentationSlide(slide, audioData)) {
          const narrationText = getSlideNarrationText(slide);
          queue.push({ 
            text: narrationText, 
            slideIndex: index,
            subtitleChunks: splitIntoSubtitleChunks(narrationText),
            hasInfographic: !!slide.infographicUrl,
            audioUrl: audioData?.url,
            audioDurationSec: audioData?.durationSec
          });
        }
      });
      
      if (queue.length > 0) {
        narrationQueueRef.current = queue;
        audioUrlBySlideRef.current = new Map(
          queue.filter(q => q.audioUrl).map(q => [q.slideIndex, q.audioUrl as string])
        );
        setCurrentSlideIndex(0);
        setProgress(0);
        setCurrentTime(0);
        
        // Use requestAnimationFrame to ensure first slide is painted before audio starts
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            startNarration();
          });
        });
      }
    }
  }, [currentResponse, isMuted, isPresentationReady, isPreparingAudio, flowState, animationDirection, buildAudioUrlMap]);

  const startNarration = async () => {
    if (isNarratingRef.current || narrationQueueRef.current.length === 0) return;
    const runId = ++narrationRunIdRef.current;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    isNarratingRef.current = true;
    setIsNarrating(true);
    setIsPaused(false);
    isPausedRef.current = false;
    
    // Per-slide progress tracking: read currentTime/duration from the active <audio>.
    // Falls back to 0 between slides when no audio element is mounted.
    progressIntervalRef.current = setInterval(() => {
      const a = urlAudioRef.current;
      if (a && isFinite(a.duration) && a.duration > 0) {
        setCurrentTime(a.currentTime);
        setTotalTime(a.duration);
        setProgress(Math.min((a.currentTime / a.duration) * 100, 100));
      }
    }, 100);
    
    await processNarrationQueue(runId);
  };

  const processNarrationQueue = async (runId: number) => {
    while (runId === narrationRunIdRef.current && narrationQueueRef.current.length > 0 && !isMutedRef.current) {
      // Check for pause - if paused, exit loop cleanly so resume can restart
      if (runId !== narrationRunIdRef.current || isPausedRef.current) {
        console.log('[Narration] Paused - exiting queue processing');
        break;
      }
      
      const item = narrationQueueRef.current[0];
      
      // Track the last played slide for completion detection
      lastPlayedSlideIndexRef.current = item.slideIndex;
      
      setCurrentSlideIndex(item.slideIndex);
      setInfographicPhase('hidden');
      videoPlaybackRef.current = null;
      setVideoSeekRequest({ slideIndex: item.slideIndex, time: 0, nonce: Date.now() });

      const slideForItem = activeResponse?.presentationSlides?.[item.slideIndex];
      const hasSlideVideo = !!slideForItem?.videoUrl;

      // Per-slide controller: reset time/progress; totalTime = this slide's duration
      setCurrentTime(0);
      setProgress(0);
      if (item.audioDurationSec && item.audioDurationSec > 0) {
        setTotalTime(item.audioDurationSec);
      }
      
      // Use actual duration if available, otherwise estimate from word count
      const wordsInText = item.text.trim() ? item.text.trim().split(/\s+/).length : 8;
      const wordsPerSecond = 2.0;
      const estimatedDurationMs = item.audioDurationSec 
        ? item.audioDurationSec * 1000 
        : Math.max(3500, (wordsInText / wordsPerSecond) * 1000);
      if (!item.audioDurationSec) {
        setTotalTime(estimatedDurationMs / 1000);
      }
      
      const totalChunks = item.subtitleChunks.length;
      const timePerChunk = Math.max(1800, estimatedDurationMs / totalChunks);
      
      // 40-40-20 timing phases (concurrent with narration)
      const phase1Duration = estimatedDurationMs * 0.40; // Slide display
      const phase2Duration = estimatedDurationMs * 0.40; // Infographic zoom
      
      let chunkIndex = 0;
      setCurrentSubtitle(item.subtitleChunks[0] || item.text);
      
      // Start speech and track completion
      let speechCompleted = false;
      let wasStopped = false;
      const speechStartTime = Date.now();
      
      // PRIORITY: Use stored audio URL if available, otherwise fall back to TTS cache
      let audioFailed = false;
      const handleCacheProgress = ({ currentTime, duration, progress: audioProgress }: { currentTime: number; duration: number; progress: number }) => {
        setCurrentTime(currentTime);
        setTotalTime(duration);
        setProgress(audioProgress);
      };
      
      if (item.audioUrl && hasSlideVideo) {
        // Video-master / Audio-slave: <PresentationSlide> owns the paired
        // audio+video playback via a sync engine. We advance this queue based
        // on video-ended (handled below in the hasSlideVideo wait branch).
        console.log(`[Narration] Video-master sync for slide ${item.slideIndex} (audio slaved inside slide)`);
        // Ensure the parent-owned audio element isn't left over from a prior slide.
        if (urlAudioRef.current) {
          try { urlAudioRef.current.pause(); } catch {}
          urlAudioRef.current = null;
        }
      } else if (item.audioUrl) {
        console.log(`[Narration] Playing from stored URL for slide ${item.slideIndex}`);
        playAudioFromUrl(item.audioUrl).then((success) => {
          if (success) {
            speechCompleted = true;
          } else {
            audioFailed = true;
            console.warn('[Narration] URL playback failed; using visual/video timing fallback');
          }
        });
      } else if (activeResponse?.cached) {
        // Cached/Solutions presentations must use stored audio URLs only.
        // Do not instantly complete missing-audio slides; keep the slide visible
        // and let manim video (or visual fallback timing) drive advancement.
        audioFailed = true;
        console.warn(`[Narration] Missing stored audio URL for cached slide ${item.slideIndex}; using ${hasSlideVideo ? 'video' : 'visual'} timing`);
      } else {
        // New Ask-AI presentations use pre-generated TTS cache only (no browser speech fallback).
        console.log(`[Narration] Playing from TTS cache for slide ${item.slideIndex}`);
        speakFromCache(item.text, narrationLanguage, 'male', undefined, handleCacheProgress).then((cacheSuccess) => {
          if (cacheSuccess) {
            speechCompleted = true;
          } else {
            audioFailed = true;
            console.warn('[Narration] Audio cache miss; using visual/video timing fallback');
          }
        });
      }
      
      // Schedule infographic phases CONCURRENT with narration (40-40-20)
      const infographicTimers: ReturnType<typeof setTimeout>[] = [];
      if (item.hasInfographic) {
        // Phase 2 starts at 40% - zoom infographic (desktop only)
        infographicTimers.push(setTimeout(() => {
          if (!isPausedRef.current && !isMobile) {
            console.log('[Narration] Phase 2: Zooming infographic at 40%');
            setInfographicPhase('zooming');
            setTimeout(() => {
              if (!isPausedRef.current) setInfographicPhase('zoomed');
            }, 200);
          }
        }, phase1Duration));
        
        // Phase 3 starts at 80% - return to slide
        infographicTimers.push(setTimeout(() => {
          if (!isPausedRef.current) {
            console.log('[Narration] Phase 3: Returning to slide at 80%');
            setInfographicPhase('returning');
            setTimeout(() => {
              if (!isPausedRef.current) setInfographicPhase('hidden');
            }, 300);
          }
        }, phase1Duration + phase2Duration));
      }
      
      // Sync subtitles with audio timing
      subtitleIntervalRef.current = setInterval(() => {
        if (chunkIndex < totalChunks - 1) {
          chunkIndex++;
          setCurrentSubtitle(item.subtitleChunks[chunkIndex] || '');
        }
      }, timePerChunk);
      
      // Wait for speech to actually complete before moving to next slide
      const minWaitMs = 500; // Minimum wait to prevent racing
      let hasWaitedMinimum = false;
      
      while (!speechCompleted && !isMutedRef.current && !wasStopped) {
        // Check if paused - exit cleanly
        if (runId !== narrationRunIdRef.current || isPausedRef.current) {
          console.log('[Narration] Pause detected during speech wait');
          wasStopped = true;
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        const elapsed = Date.now() - speechStartTime;
        
        if (elapsed >= minWaitMs) hasWaitedMinimum = true;

        if (audioFailed && !hasSlideVideo) {
          const visualDurationSec = estimatedDurationMs / 1000;
          const visualTimeSec = Math.min(elapsed / 1000, visualDurationSec);
          setCurrentTime(visualTimeSec);
          setTotalTime(visualDurationSec);
          setProgress(Math.min((visualTimeSec / visualDurationSec) * 100, 100));
        }
        
        // If audio failed, use estimated timing to advance (not long safety timeout)
        if (audioFailed && !hasSlideVideo && hasWaitedMinimum && elapsed >= estimatedDurationMs) {
          console.log(`[Narration] Audio failed - advancing after estimated ${estimatedDurationMs/1000}s`);
          break;
        }
        
        // Safety timeout only as last resort (for audio that's playing but never ends).
        // If audio is currently paused (e.g. video buffering), don't advance — wait for it.
        const liveAudio = urlAudioRef.current;
        if (liveAudio && liveAudio.paused && !liveAudio.ended) {
          // Audio is paused for buffering/sync — keep waiting, do not time out.
          continue;
        }

        // Prefer audio's own progress over wall-clock elapsed so pauses don't
        // falsely trigger the safety timeout.
        const audioDur = liveAudio && isFinite(liveAudio.duration) && liveAudio.duration > 0
          ? liveAudio.duration
          : (item.audioDurationSec || 0);
        if (liveAudio && audioDur > 0) {
          const remaining = audioDur - liveAudio.currentTime;
          // Only bail if audio is essentially done but onended never fired
          if (remaining <= 0.25 && elapsed > minWaitMs + 1000) {
            console.warn('[Narration] Audio near end but no onended, advancing');
            break;
          }
          // Otherwise, keep waiting for real end — no wall-clock timeout.
          continue;
        }

        if (hasSlideVideo) {
          const video = videoPlaybackRef.current;
          if (video?.slideIndex === item.slideIndex) {
            const videoDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
            const videoTime = Math.max(0, video.currentTime || 0);
            if (videoDur > 0) {
              setCurrentTime(videoTime);
              setTotalTime(videoDur);
              setProgress(Math.min((videoTime / videoDur) * 100, 100));
              if (video.ended || videoDur - videoTime <= 0.25) {
                console.log(`[Narration] Video timing complete for slide ${item.slideIndex}`);
                break;
              }
            } else if (video.ended) {
              console.log(`[Narration] Video ended for slide ${item.slideIndex}`);
              break;
            }
          }

          const videoFallbackMs = Math.max(estimatedDurationMs, (item.audioDurationSec || 0) * 1000, 15000);
          if (elapsed < videoFallbackMs * 1.5) {
            continue;
          }
          console.warn(`[Narration] Video timing fallback for slide ${item.slideIndex}`);
          break;
        }

        const safetyTimeoutMs = item.audioDurationSec
          ? item.audioDurationSec * 1000 * 2
          : estimatedDurationMs * 2;

        if (elapsed > safetyTimeoutMs) {
          console.warn(`[Narration] Safety timeout (${safetyTimeoutMs/1000}s), moving to next slide`);
          break;
        }
      }
      
      // Clear any remaining infographic timers
      infographicTimers.forEach(timer => clearTimeout(timer));
      
      // Clear subtitle interval
      if (subtitleIntervalRef.current) {
        clearInterval(subtitleIntervalRef.current);
        subtitleIntervalRef.current = null;
      }
      
      setInfographicPhase('hidden');
      
      // If stopped/paused, exit loop cleanly
      if (runId !== narrationRunIdRef.current || wasStopped) {
        console.log('[Narration] Exiting queue due to pause/stop');
        break;
      }
      
      narrationQueueRef.current = narrationQueueRef.current.slice(1);
      
      // Smooth transition to next slide - minimal delay
      if (narrationQueueRef.current.length > 0) {
        setCurrentSubtitle('');
        
        // Very short delay for smooth visual transition
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check pause again after delay
        if (runId !== narrationRunIdRef.current || isPausedRef.current) {
          console.log('[Narration] Paused during inter-slide delay');
          break;
        }
        
        setCurrentSlideIndex(narrationQueueRef.current[0].slideIndex);
      }
    }
    
    // Only mark complete if not paused (paused = will resume later)
    if (runId === narrationRunIdRef.current && !isPausedRef.current) {
      setCurrentSubtitle('');
      setProgress(100);
      
      // Show completion dialog ONLY if:
      // 1. Queue is empty (no more slides)
      // 2. We're in continuous mode (not single-slide replay)
      // 3. We actually finished the last slide
      if (narrationQueueRef.current.length === 0) {
        const totalSlides = activeResponse?.presentationSlides?.length || 0;
        const isAtEnd = lastPlayedSlideIndexRef.current >= totalSlides - 1;
        const isContinuousMode = playbackModeRef.current === 'continuous';
        
        console.log(`[Completion Check] mode=${playbackModeRef.current}, lastSlide=${lastPlayedSlideIndexRef.current}, total=${totalSlides}, isAtEnd=${isAtEnd}`);
        
        if (isContinuousMode && isAtEnd) {
          setIsPresentationComplete(true);
          setShowCompletionDialog(true);
        }
      }
    }
    
    if (runId === narrationRunIdRef.current) {
      setIsNarrating(false);
      setInfographicPhase('hidden');
      isNarratingRef.current = false;

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  };

  const handlePlayPause = () => {
    if (isPaused) {
      // Resume: restart from current slide with continuous mode
      setIsPaused(false);
      isPausedRef.current = false;
      
      if (activeResponse) {
        console.log('[PlayPause] Resuming from slide', currentSlideIndex, 'in continuous mode');
        // Use handleResumeFromSlide for continuous autoplay (not single-slide)
        setTimeout(() => {
          handleResumeFromSlide(currentSlideIndex);
        }, 100);
      }
    } else {
      // Pause: stop everything cleanly
      console.log('[PlayPause] Pausing');
      setIsPaused(true);
      isPausedRef.current = true;
      stopAllSpeech();
      clearTimers();
      
      // Reset infographic zoom state when pausing
      setInfographicPhase('hidden');
      
      // Clear queue so processNarrationQueue exits
      narrationQueueRef.current = [];
      isNarratingRef.current = false;
      setIsNarrating(false);
    }
  };

  const handleReplaySlide = (slideIndex: number) => {
    if (!activeResponse) return;
    
    stopAllSpeech();
    clearTimers();
    
    const slide = activeResponse.presentationSlides[slideIndex];
    if (!slide) return;
    
    // Get audio URL for this slide from current response or replay
    const rawAudio: any = getStoredAudioData(currentResponse) || replayAudioUrls;
    const audioUrls: SlideAudioUrl[] | undefined =
      Array.isArray(rawAudio) ? rawAudio : (Array.isArray(rawAudio?.urls) ? rawAudio.urls : undefined);
    const audioUrlMap = buildAudioUrlMap(activeResponse.presentationSlides.length, audioUrls);
    const audioData = audioUrlMap.get(slideIndex);
    const narrationText = getSlideNarrationText(slide);
    if (!shouldQueuePresentationSlide(slide, audioData)) return;

    narrationQueueRef.current = [];
    isNarratingRef.current = false;
    setIsNarrating(false);
    setCurrentSlideIndex(slideIndex);
    setInfographicPhase('hidden');
    setIsPaused(false);

    // Set to single mode - this prevents completion dialog after one slide
    playbackModeRef.current = 'single';
    
    narrationQueueRef.current = [{
      text: narrationText,
      slideIndex,
      subtitleChunks: splitIntoSubtitleChunks(narrationText),
      hasInfographic: !!slide.infographicUrl,
      audioUrl: audioData?.url,
      audioDurationSec: audioData?.durationSec
    }];
    
    setTimeout(() => startNarration(), 300);
  };

  // Resume autoplay from a specific slide to the end (for "Continue Reviewing")
  const handleResumeFromSlide = (startSlideIndex: number) => {
    if (!activeResponse) return;
    
    stopAllSpeech();
    clearTimers();
    
    // Reset completion state and set continuous mode
    setIsPresentationComplete(false);
    setHasResumedReview(true);
    playbackModeRef.current = 'continuous';  // Enable continuous autoplay
    isPausedRef.current = false;
    setIsPaused(false);
    
    // Get audio URLs
    const rawAudio: any = getStoredAudioData(currentResponse) || replayAudioUrls;
    const audioUrls: SlideAudioUrl[] | undefined =
      Array.isArray(rawAudio) ? rawAudio : (Array.isArray(rawAudio?.urls) ? rawAudio.urls : undefined);
    const audioUrlMap = buildAudioUrlMap(
      activeResponse.presentationSlides.length,
      audioUrls
    );

    
    // Build queue from startSlideIndex to the end (ALL remaining slides)
    narrationQueueRef.current = [];
    for (let i = startSlideIndex; i < activeResponse.presentationSlides.length; i++) {
      const slide = activeResponse.presentationSlides[i];
      const audioData = audioUrlMap.get(i);
      if (!shouldQueuePresentationSlide(slide, audioData)) continue;
      const narrationText = getSlideNarrationText(slide);
      narrationQueueRef.current.push({
        text: narrationText,
        slideIndex: i,
        subtitleChunks: splitIntoSubtitleChunks(narrationText),
        hasInfographic: !!slide.infographicUrl,
        audioUrl: audioData?.url,
        audioDurationSec: audioData?.durationSec
      });
    }
    
    isNarratingRef.current = false;
    setIsNarrating(false);
    setCurrentSlideIndex(startSlideIndex);
    setInfographicPhase('hidden');
    
    console.log(`[ResumeFromSlide] Resuming from slide ${startSlideIndex}, ${narrationQueueRef.current.length} slides queued`);
    
    // Start continuous narration
    setTimeout(() => startNarration(), 300);
  };

  const clearTimers = () => {
    if (subtitleIntervalRef.current) {
      clearInterval(subtitleIntervalRef.current);
      subtitleIntervalRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Cancel/back button handler - stops processing and returns to idle
  const handleCancelProcessing = useCallback(() => {
    console.log('[Cancel] User cancelled processing');
    
    // SET CANCELLATION FLAG FIRST - this stops handleSend async chain
    isCancelledRef.current = true;
    
    // Stop all speech and clear timers
    stopAllSpeech();
    clearTimers();
    
    // Clear any active audio elements
    if (urlAudioRef.current) {
      urlAudioRef.current.pause();
      urlAudioRef.current.src = '';
      urlAudioRef.current = null;
    }
    
    // Reset all processing states
    setFlowState('idle');
    setPrevFlowState('idle');
    setAnimationDirection('none');
    setCurrentQuestion('');
    setDetectedTopicName(null);
    setTopicRelatedConcepts([]);
    setPreparationStep(0);
    setIsPreparingAudio(false);
    setIsPreparingImages(false);
    setAudioPrepareProgress({ current: 0, total: 0 });
    setImagePrepareProgress({ current: 0, total: 0 });
    setIsPresentationReady(false);
    
    // Clear any pending response
    clearResponse();
    
    toast({
      title: "Cancelled",
      description: "Processing has been cancelled",
    });
  }, [stopAllSpeech, clearResponse]);

  // Exit presentation handler - shows confirmation dialog
  const handleExitPresentation = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  // Confirm exit handler - stops presentation and returns to idle
  const handleConfirmExit = useCallback(() => {
    console.log('[Exit] User confirmed exit from presentation');
    setShowExitDialog(false);
    
    // Stop all playback
    stopAllSpeech();
    clearTimers();
    narrationQueueRef.current = [];
    isNarratingRef.current = false;
    
    // Reset all states
    setIsNarrating(false);
    setIsPaused(false);
    setIsPresentationReady(false);
    setIsPresentationComplete(false);
    setFlowState('idle');
    setPrevFlowState('idle');
    setAnimationDirection('none');
    setCurrentSlideIndex(0);
    setCurrentSubtitle('');
    setProgress(0);
    setCurrentTime(0);
    setInfographicPhase('hidden');
    setPresentationSource(null);
    clearResponse();
    
    toast({
      title: narrationLanguage === 'hi-IN' ? "प्रस्तुति समाप्त" : "Presentation Ended",
      description: narrationLanguage === 'hi-IN' ? "आप एक नया प्रश्न पूछ सकते हैं" : "You can ask a new question",
    });
  }, [stopAllSpeech, clearResponse, narrationLanguage]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || flowState !== 'idle') return;
    if (!consumePreviewQuota()) return;

    
    // Reset cancellation flag at start of new request
    isCancelledRef.current = false;
    
    // Stop microphone listening immediately when sending question - use abortListening for reliability
    forceStopListeningRef.current = true;
    SpeechRecognition.abortListening();
    resetTranscript();
    console.log('[Speech] Force aborted listening - question submitted');
    
    // Reset force flag after a delay
    setTimeout(() => {
      forceStopListeningRef.current = false;
    }, 500);
    
    stopAllSpeech();
    clearTimers();
    narrationQueueRef.current = [];
    isNarratingRef.current = false;
    setIsNarrating(false);
    setInfographicPhase('hidden');
    setProgress(0);
    setCurrentTime(0);
    setIsPresentationReady(false);
    setIsPreparingAudio(false);
    setAudioPrepareProgress({ current: 0, total: 0 });
    setIsPreparingImages(false);
    setImagePrepareProgress({ current: 0, total: 0 });
    setIsPresentationComplete(false);
    setShowCompletionDialog(false);
    setDetectedTopicName(null);
    setTopicRelatedConcepts([]);
    
    const question = inputText.trim();
    setCurrentQuestion(question);
    setInputText('');
    resetTranscript();
    clearResponse();
    setCurrentSlideIndex(0);
    setCurrentSubtitle('');
    
    // Step 1: Show "Checking database" animation FIRST
    setFlowState('checking-cache');
    
    // Step 2: Single API call - which checks cache internally
    // Always request English content - language selector only affects TTS voice
    const response = await askQuestion(question, topicId, chapterId, 'en-IN', subjectName, subjectId, userTier);
    
    // Check if cancelled during API call
    if (isCancelledRef.current) {
      console.log('[handleSend] Cancelled during API call - aborting');
      return;
    }
    
    // Step 3: Check if response is BLOCKED (subject redirect) - show dialog and reset
    if (response?.blocked) {
      console.log('[AITeachingAssistant] 🚫 BLOCKED RESPONSE - Subject mismatch, showing dialog');

      // Reset to idle so the user can ask another question
      clearResponse();
      setFlowState('idle');
      setPrevFlowState('idle');
      setAnimationDirection('none');
      setCurrentSlideIndex(0);
      setCurrentSubtitle('');
      setIsPresentationReady(false);

      // Open the off-subject dialog
      setOffSubjectDialog({
        open: true,
        message: response.message || `This question doesn't look like it's from ${subjectName || 'this subject'}.`,
        detected: response.detectedSubject ?? null,
      });

      return; // Exit early — no presentation, no audio
    }
    
    // Step 3b: Check if response is from cache - stay in preparing-audio state while TTS translates
    if (response?.cached) {
      console.log('[AITeachingAssistant] 🚀 CACHE HIT - content ready, preparing audio...');
      
      // Extract topic from cached response if available
      if (response.detectedTopic) {
        setDetectedTopicName(response.detectedTopic);
        setTopicRelatedConcepts(response.relatedConcepts || []);
      }
      
      // Transition to 'preparing-audio' state - shows PreparationAnimation while TTS translates
      // The existing useEffect will transition to 'ready' when isPresentationReady becomes true
      setPrevFlowState('checking-cache');
      setAnimationDirection('exit-left');
      
      await new Promise<void>(resolve => {
        setTimeout(() => {
          if (isCancelledRef.current) { resolve(); return; }
          setFlowState('preparing-audio');
          setAnimationDirection('enter-right');
          setTimeout(() => {
            setAnimationDirection('none');
            setPrevFlowState('preparing-audio');
            resolve();
          }, 400);
        }, 400);
      });
      
      if (isCancelledRef.current) {
        console.log('[handleSend] Cancelled after cache transition - aborting');
        return;
      }
      
      return; // Exit early - preparation useEffect will transition to 'ready' after TTS completes
    }
    
    // Step 4: NOT cached - continue with full animation sequence
    // Transition to thinking animation
    console.log('[AITeachingAssistant] 📚 CACHE MISS - proceeding with full animation sequence');
    
    setPrevFlowState('checking-cache');
    setAnimationDirection('exit-left');
    
    await new Promise<void>(resolve => {
      setTimeout(() => {
        if (isCancelledRef.current) { resolve(); return; }
        setFlowState('thinking');
        setAnimationDirection('enter-right');
        setTimeout(() => {
          setAnimationDirection('none');
          setPrevFlowState('thinking');
          resolve();
        }, 400);
      }, 400);
    });
    
    if (isCancelledRef.current) {
      console.log('[handleSend] Cancelled after thinking transition - aborting');
      return;
    }
    
    // Extract topic from response (no separate API call needed)
    if (response?.detectedTopic) {
      setDetectedTopicName(response.detectedTopic);
      setTopicRelatedConcepts(response.relatedConcepts || []);
      
      // Transition to topic-detected animation
      setPrevFlowState('thinking');
      setAnimationDirection('exit-left');
      
      await new Promise<void>(resolve => {
        setTimeout(() => {
          if (isCancelledRef.current) { resolve(); return; }
          setFlowState('topic-detected');
          setAnimationDirection('enter-right');
          setTimeout(() => {
            setAnimationDirection('none');
            setPrevFlowState('topic-detected');
          }, 400);
          resolve();
        }, 400);
      });
      
      if (isCancelledRef.current) {
        console.log('[handleSend] Cancelled after topic-detected transition - aborting');
        return;
      }
      
      // Wait 3 seconds for topic-detected animation to display
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (isCancelledRef.current) {
        console.log('[handleSend] Cancelled after topic display - aborting');
        return;
      }
    }
    
    // Step 5: Transition to preparing state with step animations (3 seconds each step)
    setPrevFlowState(flowState);
    setAnimationDirection('exit-left');
    
    await new Promise<void>(resolve => {
      setTimeout(() => {
        if (isCancelledRef.current) { resolve(); return; }
        setFlowState('preparing');
        setPreparationStep(0);
        setAnimationDirection('enter-right');
        
        setTimeout(() => {
          setAnimationDirection('none');
          setPrevFlowState('preparing');
          resolve();
        }, 400);
      }, 400);
    });
    
    if (isCancelledRef.current) {
      console.log('[handleSend] Cancelled after preparing transition - aborting');
      return;
    }
    
    // Step 6: Progress through preparation steps - 3 seconds each, 2 steps
    // Step 0: "Creating slides" (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (isCancelledRef.current) {
      console.log('[handleSend] Cancelled after step 0 - aborting');
      return;
    }
    
    setPreparationStep(1);
    
    // Step 1: "Preparing presentation" (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (isCancelledRef.current) {
      console.log('[handleSend] Cancelled after step 1 - aborting');
      return;
    }
    
    // Step 7: After preparation steps, explicitly transition to preparing-audio
    // This ensures the audio animation shows regardless of timing issues
    setPrevFlowState('preparing');
    setAnimationDirection('exit-left');
    
    await new Promise<void>(resolve => {
      setTimeout(() => {
        if (isCancelledRef.current) { resolve(); return; }
        setFlowState('preparing-audio');
        setAnimationDirection('enter-right');
        setTimeout(() => {
          setAnimationDirection('none');
          setPrevFlowState('preparing-audio');
          resolve();
        }, 400);
      }, 400);
    });
    
    if (isCancelledRef.current) {
      console.log('[handleSend] Cancelled after preparing-audio transition - aborting');
      return;
    }
    
    // Note: flowState will transition to 'ready' when isPresentationReady becomes true
    // via the existing useEffect that watches isPresentationReady
  };


  const [isMicLoading, setIsMicLoading] = useState(false);

  const handleVoiceToggle = async () => {
    console.log('[Speech] handleVoiceToggle called');
    console.log('[Speech] Current listening state:', listening);
    console.log('[Speech] browserSupportsSpeechRecognition:', browserSupportsSpeechRecognition);
    console.log('[Speech] isMicrophoneAvailable:', isMicrophoneAvailable);
    
    if (listening || isStopping) {
      // Prevent multiple rapid clicks during stopping process
      if (isStopping) {
        console.log('[Speech] Already stopping, ignoring click');
        return;
      }
      
      // Use robust stop with multiple methods
      await forceStopMic('user toggle off');
      resetTranscript();
      return;
    }
    
    // Stop TTS if playing when user wants to speak
    if (isTTSSpeaking) {
      console.log('[Speech] Stopping TTS to allow voice input');
      stopAllSpeech();
    }
    
    setIsMicLoading(true);
    resetTranscript();
    
    try {
      // Acquire voice lock first - this will stop SalesAssistant if active
      voiceLock.acquire('teaching');
      
      // Request mic permission explicitly before starting
      console.log('[Speech] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Release the stream
      console.log('[Speech] Microphone permission granted');
      
      // Always use English for STT - language selector only affects TTS output
      await SpeechRecognition.startListening({ continuous: true, language: 'en-IN' });
      console.log('[Speech] Started listening successfully');
    } catch (error) {
      console.error('[Speech] Failed to start listening:', error);
      
      // Check if it's a permission error
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access in your browser settings to use voice input.",
          variant: "destructive"
        });
      } else if (error instanceof Error && error.name === 'NotFoundError') {
        toast({
          title: "No Microphone Found",
          description: "Please connect a microphone to use voice input.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Microphone Error",
          description: error instanceof Error ? error.message : "Failed to start speech recognition. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsMicLoading(false);
    }
  };

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    if (lang === narrationLanguage || isLanguageSwitching) return;
    
    console.log(`🌐 Switching language from ${narrationLanguage} to ${lang}...`);
    
    // Stop current audio and narration
    stopAllSpeech();
    clearTimers();
    isNarratingRef.current = false;
    setIsNarrating(false);
    setInfographicPhase('hidden');
    setIsLanguageSwitching(true);
    
    // Show switching toast
    toast({
      title: "Switching language...",
      description: `Preparing ${SUPPORTED_LANGUAGES[lang].name} audio`,
    });
    
    // Clear audio cache for the new language generation
    clearAudioCache();
    
    // Update language state
    setNarrationLanguage(lang);
    
    // Re-cache audio for remaining slides in new language
    if (activeResponse?.presentationSlides) {
      const remainingSlides = activeResponse.presentationSlides.slice(currentSlideIndex);
      
      console.log(`🔊 Pre-caching ${remainingSlides.length} slides in ${SUPPORTED_LANGUAGES[lang].name}...`);
      
      try {
        // Pre-cache audio for remaining slides in the new language
        await precacheAllSlides(
          remainingSlides,
          lang,
          'male',
          (current, total) => {
            console.log(`🌐 Language switch progress: ${current}/${total} slides`);
          }
        );
        
        console.log(`✅ Language switch complete - resuming playback`);
        
        // Build new narration queue (language switch = no stored audio, uses TTS cache)
        const queue: Array<{ 
          text: string; 
          slideIndex: number; 
          subtitleChunks: string[]; 
          hasInfographic: boolean;
          audioUrl?: string;
          audioDurationSec?: number;
        }> = [];
        
        remainingSlides.forEach((slide, idx) => {
          if (shouldQueuePresentationSlide(slide)) {
            const narrationText = getSlideNarrationText(slide);
            queue.push({
              text: narrationText,
              slideIndex: currentSlideIndex + idx,
              subtitleChunks: splitIntoSubtitleChunks(narrationText),
              hasInfographic: !!slide.infographicUrl,
              // No audioUrl for language-switched slides - they use TTS cache
              audioUrl: undefined,
              audioDurationSec: undefined
            });
          }
        });
        
        if (queue.length > 0) {
          narrationQueueRef.current = queue;
          setTimeout(() => startNarration(), 300);
        }
        
        toast({
          title: "Language switched",
          description: `Now playing in ${SUPPORTED_LANGUAGES[lang].name}`,
        });
      } catch (err) {
        console.error('Language switch failed:', err);
        toast({
          title: "Language switch failed",
          description: "Could not load audio in the selected language",
          variant: "destructive"
        });
      }
    }
    
    setIsLanguageSwitching(false);
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (newMuted) {
      stopAllSpeech();
      clearTimers();
      narrationQueueRef.current = [];
      isNarratingRef.current = false;
      setIsNarrating(false);
      setInfographicPhase('hidden');
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      const newIndex = currentSlideIndex - 1;
      if (playbackModeRef.current === 'continuous') {
        handleResumeFromSlide(newIndex);
      } else {
        handleReplaySlide(newIndex);
      }
    }
  };

  const handleNextSlide = () => {
    if (activeResponse && currentSlideIndex < activeResponse.presentationSlides.length - 1) {
      const newIndex = currentSlideIndex + 1;
      if (playbackModeRef.current === 'continuous') {
        handleResumeFromSlide(newIndex);
      } else {
        handleReplaySlide(newIndex);
      }
    }
  };

  // Synchronous fullscreen ref to prevent race conditions during transitions
  const isFullscreenRef = useRef(false);

  const handleFullScreenToggle = async () => {
    if (!isFullscreenRef.current) {
      try {
        await containerRef.current?.requestFullscreen?.();
        // Try to lock to landscape orientation
        try {
          await (screen.orientation as any).lock?.('landscape');
        } catch (e) {
          console.log('[Fullscreen] Orientation lock not supported:', e);
        }
        isFullscreenRef.current = true;
        setIsFullScreen(true);
      } catch (e) {
        console.error('[Fullscreen] Failed to enter fullscreen:', e);
      }
    } else {
      try {
        await document.exitFullscreen?.();
        // Unlock orientation
        try {
          (screen.orientation as any).unlock?.();
        } catch (e) {
          // ignore
        }
        isFullscreenRef.current = false;
        setIsFullScreen(false);
      } catch (e) {
        console.error('[Fullscreen] Failed to exit fullscreen:', e);
      }
    }
  };

  const handleMinimizeToggle = () => {
    setIsMinimized(!isMinimized);
  };

  const handleSeek = (newProgress: number) => {
    const pct = Math.max(0, Math.min(100, newProgress));
    const currentVideo = videoPlaybackRef.current;
    const hasCurrentVideo =
      Boolean(currentSlide?.videoUrl) &&
      currentVideo?.slideIndex === currentSlideIndex &&
      Number.isFinite(currentVideo.duration) &&
      currentVideo.duration > 0;

    if (hasCurrentVideo) {
      const target = (pct / 100) * currentVideo.duration;
      setVideoSeekRequest({ slideIndex: currentSlideIndex, time: target, nonce: Date.now() });
      videoPlaybackRef.current = {
        ...currentVideo,
        currentTime: target,
        ended: false,
      };
      setCurrentTime(target);
      setTotalTime(currentVideo.duration);
      setProgress(pct);
      return;
    }

    // Smooth in-slide seek: scrub the active <audio> element to the new position.
    const a = urlAudioRef.current;
    if (a && isFinite(a.duration) && a.duration > 0) {
      const target = (pct / 100) * a.duration;
      try {
        a.currentTime = target;
      } catch (e) {
        console.warn('[handleSeek] seek failed', e);
      }
      setCurrentTime(target);
      setProgress(pct);
    } else {
      // No audio yet — just reflect the slider position visually.
      setProgress(pct);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    try {
      if (urlAudioRef.current) urlAudioRef.current.playbackRate = speed;
    } catch {}
  };

  const [replayResponse, setReplayResponse] = useState<TeachingResponse | null>(null);
  const [replayAudioUrls, setReplayAudioUrls] = useState<SlideAudioUrl[] | null>(null);

  const handleReplay = async (
    slides: PresentationSlide[], 
    narrationText: string, 
    audioUrls?: SlideAudioUrl[], 
    language?: string
  ) => {
    stopAllSpeech();
    clearTimers();
    narrationQueueRef.current = [];
    isNarratingRef.current = false;
    setIsNarrating(false);
    setInfographicPhase('hidden');
    setFlowState('preparing-audio');
    
    const response: TeachingResponse = {
      cached: true,
      answer: narrationText,
      presentationSlides: slides,
      latexFormulas: [],
      keyPoints: [],
      followUpQuestions: [],
      narrationText: narrationText,
    };
    
    setReplayResponse(response);
    setReplayAudioUrls(audioUrls || null);
    setCurrentSlideIndex(0);
    setCurrentSubtitle('');
    setProgress(0);
    
    // If we have stored audio URLs, we can play directly without TTS regeneration
    const hasStoredAudio = audioUrls && audioUrls.length > 0;
    
    if (hasStoredAudio) {
      console.log('[Replay] Using stored audio URLs - instant playback');
      // Calculate total duration from stored audio
      const totalDuration = audioUrls.reduce((sum, a) => sum + a.duration, 0);
      setTotalTime(totalDuration);
      
      // Preload images only (audio is already available)
      await preloadImages(slides);
      
      // Set ready state
      setFlowState('ready');
      setIsPresentationReady(true);
    } else {
      console.log('[Replay] No stored audio - regenerating via TTS');
      // Fall back to TTS regeneration for older entries
      const replayLang = (language as SupportedLanguage) || narrationLanguage;
      
      // Pre-cache audio for all slides
      const result = await precacheAllSlides(slides, replayLang, 'male');
      if (result.totalDurationSeconds > 0) {
        setTotalTime(result.totalDurationSeconds);
      }
      
      // Preload images
      await preloadImages(slides);
      
      setFlowState('ready');
      setIsPresentationReady(true);
    }
    
    // Build audio URL map from replay audio URLs
    const audioUrlMap = buildAudioUrlMap(slides.length, audioUrls);
    
    // Build narration queue WITH audio URLs
    const queue: Array<{ 
      text: string; 
      slideIndex: number; 
      subtitleChunks: string[]; 
      hasInfographic: boolean;
      audioUrl?: string;
      audioDurationSec?: number;
    }> = [];
    
    slides.forEach((slide, index) => {
      const audioData = audioUrlMap.get(index);
      if (shouldQueuePresentationSlide(slide, audioData)) {
        const text = getSlideNarrationText(slide);
        queue.push({ 
          text, 
          slideIndex: index,
          subtitleChunks: splitIntoSubtitleChunks(text),
          hasInfographic: !!slide.infographicUrl,
          audioUrl: audioData?.url,
          audioDurationSec: audioData?.durationSec
        });
      }
    });
    
    if (queue.length > 0 && !isMuted) {
      narrationQueueRef.current = queue;
      setTimeout(() => startNarration(), 500);
    }
  };

  const activeResponse = currentResponse || replayResponse;
  const totalSlides = activeResponse?.presentationSlides?.length || 0;
  const currentSlide = activeResponse?.presentationSlides?.[currentSlideIndex];

  const queueStudentSlidePreload = useCallback((slideIndex: number) => {
    if (!activeResponse?.presentationSlides) return;
    if (slideIndex < 0 || slideIndex >= activeResponse.presentationSlides.length) return;
    if (readySlideIndexes.has(slideIndex) || preloadingSlideIndexesRef.current.has(slideIndex)) return;

    preloadingSlideIndexesRef.current.add(slideIndex);
    const slide = activeResponse.presentationSlides[slideIndex];
    const audioUrl = audioUrlBySlideRef.current.get(slideIndex);
    preloadSlideMedia(slide, audioUrl)
      .then(() => {
        setReadySlideIndexes((prev) => {
          const next = new Set(prev);
          next.add(slideIndex);
          return next;
        });
      })
      .finally(() => {
        preloadingSlideIndexesRef.current.delete(slideIndex);
      });
  }, [activeResponse, readySlideIndexes]);

  useEffect(() => {
    setReadySlideIndexes(new Set());
    preloadingSlideIndexesRef.current.clear();
  }, [activeResponse]);

  useEffect(() => {
    if (!isPresentationReady || !activeResponse?.presentationSlides) return;
    for (let i = currentSlideIndex; i <= currentSlideIndex + SLIDE_PRELOAD_AHEAD; i++) {
      queueStudentSlidePreload(i);
    }
  }, [activeResponse, currentSlideIndex, isPresentationReady, queueStudentSlidePreload]);

  useEffect(() => {
    if (currentResponse) {
      setReplayResponse(null);
    }
  }, [currentResponse]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  // Listen for fullscreen changes - sync ref + state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      isFullscreenRef.current = isFs;
      setIsFullScreen(isFs);
      if (!isFs) {
        // Unlock orientation when exiting fullscreen
        try {
          (screen.orientation as any).unlock?.();
        } catch (e) {
          // ignore
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Minimized View
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-background/95 backdrop-blur-md border rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          className="h-8 w-8 p-0"
        >
          {isPaused ? <Play className="h-4 w-4" /> : <span className="h-4 w-4">❚❚</span>}
        </Button>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            📖 {currentSlide?.title || topicTitle || 'Presentation'}
          </p>
          <p className="text-xs text-muted-foreground">
            Slide {currentSlideIndex + 1} / {totalSlides}
          </p>
        </div>
        
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTime(currentTime)} / {formatTime(totalTime)}
        </span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMinimizeToggle}
          className="h-8 w-8 p-0"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div 
        ref={containerRef}
        className={cn(
          "flex flex-col bg-background relative overflow-hidden",
          isFullScreen 
            ? "fixed inset-0 z-50" 
            : isMobile && flowState === 'ready' && isPresentationReady
              ? "fixed inset-0 z-50"
              : flowState === 'ready' && isPresentationReady
                ? "h-[calc(100vh-48px)]"
                : "h-[calc(100vh-80px)]"
        )}
      >
        {/* Persistent gradient and dotted background - z-0 layer */}
        <div className="absolute inset-0 z-0">
          <ParticleBackground particleCount={60} className="opacity-60" />
        </div>
        
        {/* Content layer - z-10 to sit above background */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Question History Button - hidden during presentation */}
          {!(flowState === 'ready' && isPresentationReady) && (
            <QuestionHistory
              topicId={topicId}
              chapterId={chapterId}
              onReplay={handleReplay}
            />
          )}

        {/* Main Content Area */}
        <div className={cn(
          "flex-1 flex gap-2 min-h-0 p-0 md:p-2",
          isFullScreen ? "p-4" : ""
        )}>
          {/* Presentation Area - 90% in normal mode, 100% in fullscreen */}
          <div className={cn(
            "flex flex-col min-h-0 h-full",
            isFullScreen || isMobile ? "flex-1" : "flex-[90]"
          )}>
            {/* Presentation Display */}
            <div className="flex-1 relative min-h-0 overflow-hidden h-full">
              {/* UNIFIED LOADING STATE - Single 2D Animation.
                  Once the presentation is ready and a slide is mounted, suppress the loader for
                  the rest of this response — even if downstream effects briefly flip flowState
                  back to 'preparing-audio' (replay, language switch, slide transition). */}
              {(flowState === 'checking-cache' || 
                flowState === 'thinking' || 
                flowState === 'topic-detected' || 
                flowState === 'preparing' || 
                flowState === 'preparing-audio') &&
                !(isPresentationReady && activeResponse && currentSlide) && (
                <Card className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden border-0 glass-strong">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 z-50 hover:bg-white/10"
                    onClick={handleCancelProcessing}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <PreparationAnimation />
                </Card>
              )}


              {/* FLOW STATE: Ready - Presentation Display.
                  Keep rendering whenever the presentation is mounted, regardless of transient flowState flips. */}
              {isPresentationReady && activeResponse && currentSlide && (
                isMobile && !isFullScreen ? (
                  /* MOBILE: Split layout matching lecture player - 55vh player top + scrollable bottom */
                  <div className="flex flex-col h-full">
                    {/* Top: Slide + Controls constrained to 55vh */}
                    <div 
                      className="shrink-0 relative overflow-hidden"
                      style={{ height: '55vh' }}
                      onMouseMove={resetControlsTimeout}
                      onClick={resetControlsTimeout}
                    >
                      <SlideComponent
                        slide={{ ...currentSlide, audioUrl: audioUrlBySlideRef.current.get(currentSlideIndex) }}
                        isActive={true}
                        slideNumber={currentSlideIndex + 1}
                        totalSlides={totalSlides}
                        isStorySlide={currentSlide.isStory}
                        currentSubtitle={currentSubtitle}
                        isNarrating={isNarrating}
                        infographicPhase={infographicPhase}
                        onReplaySlide={() => handleReplaySlide(currentSlideIndex)}
                        isFullScreen={false}
                        onVideoWaiting={() => { try { urlAudioRef.current?.pause(); } catch {} }}
                        onVideoResumed={() => { try { if (urlAudioRef.current && isNarratingRef.current) urlAudioRef.current.play().catch(() => {}); } catch {} }}
                        onVideoProgress={(state) => {
                          videoPlaybackRef.current = { slideIndex: currentSlideIndex, ...state };
                        }}
                        onVideoEnded={() => {
                          const previous = videoPlaybackRef.current;
                          videoPlaybackRef.current = {
                            slideIndex: currentSlideIndex,
                            duration: previous?.duration || 0,
                            currentTime: previous?.duration || previous?.currentTime || 0,
                            ended: true,
                            playing: false,
                          };
                        }}
                        videoSeekRequest={videoSeekRequest?.slideIndex === currentSlideIndex ? videoSeekRequest : null}
                        assumeMediaReady={readySlideIndexes.has(currentSlideIndex)}
                        playbackSpeed={playbackSpeed}
                      />
                      
                      {/* Playback Controls - always visible at bottom of player area */}
                      <div className="absolute bottom-0 left-0 right-0 z-30">
                        <PlaybackControls
                          isPaused={isPaused}
                          onPlayPause={handlePlayPause}
                          onPrevSlide={handlePrevSlide}
                          onNextSlide={handleNextSlide}
                          currentSlide={currentSlideIndex}
                          totalSlides={totalSlides}
                          isFullScreen={false}
                          onFullScreenToggle={handleFullScreenToggle}
                          isMinimized={isMinimized}
                          onMinimizeToggle={handleMinimizeToggle}
                          playbackSpeed={playbackSpeed}
                          onSpeedChange={handleSpeedChange}
                          progress={progress}
                          onSeek={handleSeek}
                          currentTime={formatTime(currentTime)}
                          totalTime={formatTime(totalTime)}
                          onExitPresentation={handleExitPresentation}
                          avatarUrl={avatarUrl}
                          isSpeaking={isTTSSpeaking || isNarrating}
                          isProcessing={isLoading}
                          lockedMobile={true}
                        />
                      </div>
                    </div>

                    {/* Bottom: Back + Title + Quick Actions */}
                    <div className="shrink-0 overflow-hidden bg-background">
                      {/* Back button + Title row */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleExitPresentation}
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h3 className="text-sm font-semibold truncate">
                          {currentSlide.title || currentQuestion || 'AI Presentation'}
                        </h3>
                      </div>

                    </div>
                  </div>
                ) : (
                  /* DESKTOP: Original full-area presentation layout */
                  <div 
                    className="absolute inset-0 flex flex-col"
                    onMouseMove={resetControlsTimeout}
                    onMouseEnter={resetControlsTimeout}
                    onClick={resetControlsTimeout}
                  >
                    <div className="flex-1 relative overflow-hidden rounded-xl min-h-0">
                      <SlideComponent
                        slide={{ ...currentSlide, audioUrl: audioUrlBySlideRef.current.get(currentSlideIndex) }}
                        isActive={true}
                        slideNumber={currentSlideIndex + 1}
                        totalSlides={totalSlides}
                        isStorySlide={currentSlide.isStory}
                        currentSubtitle={currentSubtitle}
                        isNarrating={isNarrating}
                        infographicPhase={infographicPhase}
                        onReplaySlide={() => handleReplaySlide(currentSlideIndex)}
                        isFullScreen={isFullScreen}
                        onVideoWaiting={() => { try { urlAudioRef.current?.pause(); } catch {} }}
                        onVideoResumed={() => { try { if (urlAudioRef.current && isNarratingRef.current) urlAudioRef.current.play().catch(() => {}); } catch {} }}
                        onVideoProgress={(state) => {
                          videoPlaybackRef.current = { slideIndex: currentSlideIndex, ...state };
                        }}
                        onVideoEnded={() => {
                          const previous = videoPlaybackRef.current;
                          videoPlaybackRef.current = {
                            slideIndex: currentSlideIndex,
                            duration: previous?.duration || 0,
                            currentTime: previous?.duration || previous?.currentTime || 0,
                            ended: true,
                            playing: false,
                          };
                        }}
                        videoSeekRequest={videoSeekRequest?.slideIndex === currentSlideIndex ? videoSeekRequest : null}
                        assumeMediaReady={readySlideIndexes.has(currentSlideIndex)}
                        playbackSpeed={playbackSpeed}
                      />
                      
                      {/* Exit Button - Top Left, always visible */}
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={handleExitPresentation}
                        className={cn(
                          "absolute top-4 left-4 z-40",
                          "h-12 w-12 p-0 rounded-full",
                          "bg-black/60 backdrop-blur-sm",
                          "text-white hover:bg-red-500/80 hover:text-white",
                          "border border-white/20 hover:border-red-400",
                          "shadow-lg transition-all duration-200",
                          "hover:scale-105"
                        )}
                        title="Exit Presentation"
                      >
                        <X className="h-6 w-6" />
                      </Button>
                      
                      {/* Cached/New Source Badge */}
                      {presentationSource && (
                        <Badge 
                          className={cn(
                            "absolute top-4 left-20 z-30 text-xs font-medium gap-1.5 px-2.5 py-1",
                            presentationSource === 'cached' 
                              ? "bg-blue-500/90 text-white border-blue-400/50 hover:bg-blue-500" 
                              : "bg-green-500/90 text-white border-green-400/50 hover:bg-green-500"
                          )}
                        >
                          {presentationSource === 'cached' ? (
                            <>
                              <Database className="w-3 h-3" />
                              Cached
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              New
                            </>
                          )}
                        </Badge>
                      )}
                      
                      {/* Overlay Playback Controls - auto-hide after 3s */}
                      <div 
                        className={cn(
                          "absolute bottom-0 left-0 right-0 z-30 transition-all duration-300",
                          (showControls || infographicPhase !== 'hidden')
                            ? "opacity-100 translate-y-0 pointer-events-auto" 
                            : "opacity-0 translate-y-4 pointer-events-none"
                        )}
                      >
                        <PlaybackControls
                          isPaused={isPaused}
                          onPlayPause={handlePlayPause}
                          onPrevSlide={handlePrevSlide}
                          onNextSlide={handleNextSlide}
                          currentSlide={currentSlideIndex}
                          totalSlides={totalSlides}
                          isFullScreen={isFullScreen}
                          onFullScreenToggle={handleFullScreenToggle}
                          isMinimized={isMinimized}
                          onMinimizeToggle={handleMinimizeToggle}
                          playbackSpeed={playbackSpeed}
                          onSpeedChange={handleSpeedChange}
                          progress={progress}
                          onSeek={handleSeek}
                          currentTime={formatTime(currentTime)}
                          totalTime={formatTime(totalTime)}
                          onExitPresentation={handleExitPresentation}
                          avatarUrl={avatarUrl}
                          isSpeaking={isTTSSpeaking || isNarrating}
                          isProcessing={isLoading}
                          lockedMobile={false}
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
              {showStartGate && flowState === 'idle' && !isLoading && (
                <Card className="h-full relative overflow-hidden md:overflow-y-auto border-0 bg-transparent">
                  <CardContent className="h-full flex flex-col items-center justify-center text-center py-6 px-4 max-w-2xl mx-auto relative z-10">
                    <div className="mb-4 rounded-full bg-primary/10 p-4">
                      <Sparkles className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-2">Your AI answer is ready</h2>
                    <p className="text-sm md:text-base text-muted-foreground mb-2">
                      The presentation finished preparing in the background while you were away.
                    </p>
                    <p className="text-sm italic text-foreground mb-6 px-4 py-2 rounded-md bg-muted max-w-md">
                      "{pendingJob?.question}"
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                       <Button
                         size="lg"
                         onClick={() => {
                           setCurrentQuestion(pendingJob!.question);
                           // Land on slide 0 paused — skip the loader & auto-narration
                           // because the user already chose to come back specifically
                           // to view this ready presentation.
                           enterPausedRef.current = true;
                           setIsPaused(true);
                           isPausedRef.current = true;
                           aiJobCtx.acknowledgeAndConfirm();
                           setIsPresentationReady(false);
                           setFlowState('preparing-audio');
                           setPrevFlowState('preparing-audio');
                           setAnimationDirection('none');
                         }}
                       >
                         <Play className="h-4 w-4 mr-2" />
                         Start presentation
                       </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => {
                          aiJobCtx.clearJob();
                          clearResponse();
                        }}
                      >
                        Discard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {flowState === 'idle' && !activeResponse && !isLoading && !showStartGate && (
                <Card className="h-full relative overflow-hidden md:overflow-y-auto border-0 bg-transparent">
                  
                  <CardContent className="h-full flex flex-col items-center justify-start text-center pt-4 md:pt-8 pb-24 md:pb-4 px-1 md:px-6 max-w-2xl mx-auto relative z-10 overflow-hidden">
                    
                    {/* Shimmer Gradient Title */}
                    <h2 className="text-lg md:text-3xl font-bold mb-0.5 md:mb-3 animate-shimmer-text">
                      {`Hello! I am your ${subjectName || 'Subject'} AI Teacher.`}
                    </h2>
                    
                    <p className="text-xs md:text-lg text-muted-foreground mb-1 md:mb-6 animate-slide-up-fade" style={{ animationDelay: '0.2s' }}>
                      How may I help you today?
                    </p>
                    
                    {/* Voice Language Selection - only affects TTS, not content */}
                    <div className="flex flex-col items-center gap-1 md:gap-2 mb-1 md:mb-6 animate-slide-up-fade" style={{ animationDelay: '0.25s' }}>
                      <div className="flex items-center gap-2 md:gap-3">
                        <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                        <span className="text-xs md:text-sm text-muted-foreground">
                          Voice Language:
                        </span>
                        <Select value={narrationLanguage} onValueChange={(val) => setNarrationLanguage(val as SupportedLanguage)}>
                          <SelectTrigger className="w-[140px] md:w-[160px] h-8 md:h-9 text-xs md:text-sm bg-background/80 backdrop-blur-sm border-primary/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border border-border shadow-lg">
                            {Object.entries(filteredLanguages).map(([code, info]) => (
                              <SelectItem key={code} value={code} className="cursor-pointer">
                                {info.flag} {info.shortName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground/70">
                        Slides remain in English. Voice will be in selected language.
                      </p>
                    </div>
                    
                    {/* Subject Scope Notice with Glass Effect - hidden visually, kept for TTS/source reference */}
                    <div className="hidden glass rounded-xl px-3 md:px-5 py-1.5 md:py-3 mb-1 md:mb-6 text-xs md:text-sm text-muted-foreground animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
                      {`I can answer questions about ${subjectName || 'this subject'}. For other subjects, please consult the respective teacher.`}
                    </div>

                    {/* Quick Action Suggestion Chips */}
                    <div className="hidden md:flex flex-wrap gap-1 md:gap-2 justify-center mb-1 md:mb-6 animate-slide-up-fade" style={{ animationDelay: '0.4s' }}>
                      {[
                        { icon: Brain, label: 'Explain Concept', query: 'Explain the main concept' },
                        { icon: Calculator, label: 'Show Formulas', query: 'Show me the important formulas' },
                        { icon: HelpCircle, label: 'Give Examples', query: 'Give me practical examples' },
                      ].map((chip, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "rounded-full px-3 md:px-4 py-1.5 md:py-2 h-auto",
                            "bg-gradient-to-r from-primary/5 to-secondary/5",
                            "border-primary/30 hover:border-primary/50",
                            "hover:from-primary/10 hover:to-secondary/10",
                            "transition-all duration-300"
                          )}
                          style={{ animationDelay: `${idx * 0.5}s` }}
                          onClick={() => {
                            setInputText(chip.query);
                          }}
                        >
                          <chip.icon className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-1.5 text-primary" />
                          <span className="text-xs md:text-sm">{chip.label}</span>
                        </Button>
                      ))}
                    </div>

                    {/* Desktop: Question Input inline under chips on welcome screen */}
                    {!isMobile && (
                      <>
                        {isInputFocused && (
                          <>
                            <div
                              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
                              onMouseDown={() => setIsInputFocused(false)}
                            />
                          </>
                        )}

                        <div
                          className={cn(
                            "w-full mt-6 flex justify-center px-4 transition-all duration-300",
                            isInputFocused
                              ? "fixed top-24 left-0 right-0 z-50"
                              : "relative",
                          )}
                        >
                          <div className="w-full max-w-2xl relative animate-slide-up-fade">
                            <div className="glass-strong rounded-xl px-4 py-3 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:shadow-lg">
                              <div className="flex items-center gap-3">
                                <Textarea
                                  ref={inputTextareaRef}
                                  value={inputText}
                                  rows={1}
                                  onChange={(e) => {
                                    setInputText(e.target.value);
                                    resizeInputTextarea(e.target as HTMLTextAreaElement);
                                  }}
                                  onFocus={() => setIsInputFocused(true)}
                                  onBlur={() => setTimeout(() => setIsInputFocused(false), 150)}
                                  placeholder="Type your question in English..."
                                  className="min-h-[40px] resize-none scrollbar-hide text-sm py-2 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                                  style={{ maxHeight: 'calc(1.5em * 5)', overflowY: 'hidden' }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') { setIsInputFocused(false); (e.target as HTMLTextAreaElement).blur(); return; }
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSend();
                                    }
                                  }}
                                  disabled={isLoading}
                                />

                                <div className="flex items-center gap-2 shrink-0">
                                  {browserSupportsSpeechRecognition && (
                                    <Button
                                      variant={listening ? "destructive" : "ghost"}
                                      size="sm"
                                      className={cn(
                                        "h-9 w-9 p-0 rounded-full transition-all",
                                        listening
                                          ? "bg-destructive text-destructive-foreground animate-pulse ring-2 ring-destructive/30"
                                          : "hover-glow"
                                      )}
                                      onClick={handleVoiceToggle}
                                      disabled={isLoading || isMicLoading}
                                    >
                                      {isMicLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                    </Button>
                                  )}
                                  <Button
                                    onClick={handleSend}
                                    disabled={!inputText.trim() || isLoading}
                                    size="sm"
                                    className={cn(
                                      "h-9 w-9 p-0 rounded-full transition-all",
                                      "bg-gradient-to-r from-primary to-secondary",
                                      "hover:opacity-90 hover:scale-105",
                                      "disabled:opacity-50 disabled:scale-100",
                                      inputText.trim() && !isLoading && "animate-chip-glow"
                                    )}
                                  >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            {isInputFocused && (
                              <QuestionSuggestionsDropdown
                                inputText={inputText}
                                questions={suggestionQuestions}
                                isLoading={isSearchingSuggestions}
                                hasSearched={hasSearchedSuggestions}
                                onSelect={(t) => { setInputText(t); setIsInputFocused(false); }}
                                onQuestionSelected={() => setIsInputFocused(false)}
                                className="z-[60]"
                              />
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    
                    {/* Voice Input Prompt - hidden (mic available in input field below) */}
                    {false && !isMobile && (
                    <div className="flex flex-col items-center gap-3 md:gap-4 animate-slide-up-fade" style={{ animationDelay: '0.5s' }}>
                      <p className="hidden md:block text-sm text-muted-foreground">
                        Speak your question in English or type below
                      </p>
                      
                      {browserSupportsSpeechRecognition && (
                        <div className="relative">
                          {/* Gemini-style listening animation */}
                          <ListeningAnimation isListening={listening} particleCount={60} />
                          
                          <Button
                            variant={listening ? "destructive" : "default"}
                            size="lg"
                            className={cn(
                              "relative rounded-full h-16 w-16 p-0 shadow-lg transition-all duration-300 z-10",
                              "bg-gradient-to-r from-primary to-secondary",
                              "hover:opacity-90 hover:scale-105",
                              listening && "from-destructive to-destructive ring-4 ring-destructive/30"
                            )}
                            onClick={handleVoiceToggle}
                            disabled={isLoading}
                          >
                            {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                          </Button>
                          
                          {/* Live transcript preview */}
                          {listening && transcript && (
                            <div className="absolute -top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl glass shadow-lg max-w-xs z-20">
                              <p className="text-sm text-foreground truncate">{transcript}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {listening && (
                        <p className="text-sm text-primary font-medium mt-2">
                          Listening...
                        </p>
                      )}
                    </div>
                    )}

                    {/* Mobile inline input */}
                    {isMobile && (
                      <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-2 animate-slide-up-fade" style={{ animationDelay: '0.5s' }}>
                       <div className="glass-strong rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type your question in English..."
                            className="min-h-[36px] max-h-[36px] resize-none text-sm py-1.5 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                            disabled={isLoading}
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            {browserSupportsSpeechRecognition && (
                              <Button
                                variant={listening ? "destructive" : "ghost"}
                                size="sm"
                                className={cn(
                                  "h-8 w-8 p-0 rounded-full transition-all",
                                  listening && "animate-pulse ring-2 ring-destructive/30"
                                )}
                                onClick={handleVoiceToggle}
                                disabled={isLoading || isMicLoading}
                              >
                                {isMicLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            <Button
                              onClick={handleSend}
                              disabled={!inputText.trim() || isLoading}
                              size="sm"
                              className={cn(
                                "h-8 w-8 p-0 rounded-full transition-all",
                                "bg-gradient-to-r from-primary to-secondary",
                                "hover:opacity-90 hover:scale-105",
                                "disabled:opacity-50 disabled:scale-100"
                              )}
                            >
                              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                       </div>
                       <QuestionSuggestionsDropdown
                         inputText={inputText}
                         questions={suggestionQuestions}
                         isLoading={isSearchingSuggestions}
                         hasSearched={hasSearchedSuggestions}
                         onSelect={(t) => setInputText(t)}
                         className="!top-auto bottom-full !mt-0 mb-2 max-h-[40vh]"
                       />
                      </div>

                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Outer Question Input — only shown as a follow-up input after an active response.
                Welcome screen uses an embedded input (desktop) / inline input (mobile) instead. */}
            {flowState === 'idle' && activeResponse && !isLoading && !(isPresentationReady && currentSlide) && (
            <div className="relative shrink-0 mt-2">
            <div className="glass-strong rounded-xl px-4 py-3 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:shadow-lg">

              <div className="flex items-center gap-3">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your question in English..."
                  className="min-h-[40px] max-h-[40px] resize-none text-sm py-2 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isLoading}
                />
                
                <div className="flex items-center gap-2 shrink-0">
                  {browserSupportsSpeechRecognition ? (
                    <Button
                      variant={listening ? "destructive" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-9 w-9 p-0 rounded-full transition-all",
                        listening 
                          ? "bg-destructive text-destructive-foreground animate-pulse ring-2 ring-destructive/30" 
                          : "hover-glow"
                      )}
                      onClick={handleVoiceToggle}
                      disabled={isLoading || isMicLoading}
                    >
                      {isMicLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : listening ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-full opacity-50 cursor-not-allowed"
                          disabled
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Voice input requires Chrome or Edge browser</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {/* Send button with gradient */}
                  <Button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isLoading}
                    size="sm"
                    className={cn(
                      "h-9 w-9 p-0 rounded-full transition-all",
                      "bg-gradient-to-r from-primary to-secondary",
                      "hover:opacity-90 hover:scale-105",
                      "disabled:opacity-50 disabled:scale-100",
                      inputText.trim() && !isLoading && "animate-chip-glow"
                    )}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            </div>
            )}

          </div>

          {/* Avatar Panel - 10% in normal mode, hidden in fullscreen and during presentation */}
          {!isMobile && !isFullScreen && !(flowState === 'ready' && isPresentationReady) && (
            <div className="flex-[10] min-w-[120px] max-w-[160px]">
              <TeacherAvatarPanel
                isSpeaking={isTTSSpeaking || isNarrating}
                isProcessing={isLoading}
                isMuted={isMuted}
                onMuteToggle={handleMuteToggle}
                language={narrationLanguage}
              />
            </div>
          )}
        </div>

        {/* Lesson Completion Dialog */}
        <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {narrationLanguage === 'hi-IN' ? 'पाठ पूरा हुआ!' : 'Lesson Complete!'}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                {narrationLanguage === 'hi-IN' 
                  ? 'बहुत अच्छा! मुझे आशा है कि इससे आपको विषय समझने में मदद मिली। क्या आपके कोई और प्रश्न हैं? मैं आपकी और सहायता के लिए यहां हूं!'
                  : 'Great job! I hope this helped you understand the topic better. Do you have any more questions? I am here to help you learn more!'
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCompletionDialog(false);
                  // If on last slide, restart from beginning; otherwise resume from current
                  const totalSlides = activeResponse?.presentationSlides?.length || 0;
                  const startIndex = currentSlideIndex >= totalSlides - 1 ? 0 : currentSlideIndex;
                  handleResumeFromSlide(startIndex);
                }}
                className="w-full sm:w-auto"
              >
                {narrationLanguage === 'hi-IN' ? 'समीक्षा जारी रखें' : 'Continue Reviewing'}
              </Button>
              <Button 
                onClick={() => {
                  setShowCompletionDialog(false);
                  setIsPresentationComplete(false);
                  setFlowState('idle');
                  clearResponse();
                  // Focus the input field after dialog closes
                  setTimeout(() => {
                    const textarea = document.querySelector('textarea');
                    textarea?.focus();
                  }, 100);
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {narrationLanguage === 'hi-IN' ? 'एक और प्रश्न पूछें' : 'Ask Another Question'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exit Presentation Confirmation Dialog */}
        <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                {narrationLanguage === 'hi-IN' ? 'प्रस्तुति छोड़ें?' : 'Exit Presentation?'}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                {narrationLanguage === 'hi-IN' 
                  ? 'क्या आप वाकई इस प्रस्तुति को छोड़ना चाहते हैं? आपकी प्रगति सहेजी नहीं जाएगी।'
                  : 'Are you sure you want to exit this presentation? Your progress will not be saved.'
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowExitDialog(false)}
                className="w-full sm:w-auto"
              >
                {narrationLanguage === 'hi-IN' ? 'रहें' : 'Stay'}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmExit}
                className="w-full sm:w-auto"
              >
                {narrationLanguage === 'hi-IN' ? 'छोड़ें' : 'Exit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Off-subject (wrong subject) dialog */}
        <Dialog
          open={offSubjectDialog.open}
          onOpenChange={(open) => setOffSubjectDialog((prev) => ({ ...prev, open }))}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Wrong subject
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                {offSubjectDialog.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                onClick={() => setOffSubjectDialog((prev) => ({ ...prev, open: false }))}
                className="w-full sm:w-auto"
              >
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Matched Lecture Video Player Dialog */}
        {(() => {
          const extractedJobId = extractJobIdFromUrl(aiGeneratedVideoUrl);
          if (showVideoPlayer) {
            console.log('[AI Assistant] Video player opening with:', {
              hasPresentation: !!matchedPresentation,
              aiGeneratedVideoUrl,
              extractedJobId,
            });
          }
          return (
            <EducationalVideoPlayerDialog
              open={showVideoPlayer}
              onOpenChange={(open) => {
                if (!open) {
                  setShowVideoPlayer(false);
                  setMatchedPresentation(null);
                }
              }}
              presentationData={matchedPresentation}
              externalJobId={extractedJobId || undefined}
              documentName={currentQuestion || 'AI Lecture'}
              subjectId={subjectId}
            />

          );
        })()}
        </div>
      </div>
    </TooltipProvider>
  );
}
