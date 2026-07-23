import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_DIRECT_URL } from '@/lib/supabaseUrl';
import type { TeachingResponse, PresentationSlide } from '@/hooks/useTeachingAssistant';

// --- Direct invoke (ported from useTeachingAssistant) -----------------------
async function invokeAiTeachingAssistantDirect(body: any): Promise<{ data: any; error: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 420_000);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    const res = await fetch(`${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apikey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (!res.ok) {
      return { data, error: { message: data?.error || `HTTP ${res.status}`, status: res.status } };
    }
    return { data, error: null };
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'Request timed out after 420 seconds' : (err?.message || 'Network error');
    return { data: null, error: { message } };
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeResponse(data: any): TeachingResponse {
  if (data?.blocked) {
    return {
      cached: false,
      blocked: true,
      message: data.message || data.answer || '',
      currentSubject: data.currentSubject,
      detectedSubject: data.detectedSubject ?? null,
      reason: data.reason || 'off_topic',
      answer: data.answer || data.message || '',
      presentationSlides: [],
      latexFormulas: [],
      keyPoints: [],
      followUpQuestions: [],
      narrationText: data.message || data.answer || '',
    };
  }

  const isContentRawJson = (content: string): boolean => {
    if (!content || typeof content !== 'string') return false;
    const trimmed = content.trim();
    return trimmed.startsWith('{') && (trimmed.includes('"presentation_slides"') || trimmed.includes('"title"'));
  };

  const extractMediaUrl = (candidate: any): string | null => {
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
  };

  const manimMap: Record<string, any> =
    (data as any).manimVideoUrls || (data as any).manim_video_urls || {};

  const normalizedSlides: PresentationSlide[] = (data.presentationSlides || []).map((slide: any, idx: number) => {
    if (slide.content && isContentRawJson(slide.content)) {
      return {
        title: 'Error',
        content: 'There was an issue loading this content.',
        keyPoints: ['Please try again'],
        formula: null as any,
        narration: 'Sorry, there was a problem loading this slide. Please try asking again.',
        isStory: false,
        isTips: false,
        infographic: null as any,
        infographicUrl: null as any,
        videoUrl: null as any,
      };
    }
    const manimUrl =
      extractMediaUrl(slide.manim_video_url) ||
      extractMediaUrl(slide.manimVideoUrl) ||
      extractMediaUrl(slide.videoUrl) ||
      extractMediaUrl(slide.video_url) ||
      extractMediaUrl(manimMap[idx]) ||
      extractMediaUrl(manimMap[String(idx)]);
    return {
      title: slide.title || 'Untitled Slide',
      content: slide.content || '',
      keyPoints: slide.keyPoints || slide.key_points || [],
      formula: slide.formula || null,
      narration: slide.narration || slide.content || '',
      isStory: slide.isStory === true || slide.is_story === true,
      isTips: slide.isTips === true || slide.is_tips === true,
      infographic: slide.infographic || null,
      infographicUrl: slide.infographicUrl || slide.infographic_url || null,
      videoUrl: manimUrl,
    };
  });

  const validSlides = normalizedSlides.filter(slide => slide.title !== 'Error');
  const slidesToUse = validSlides.length > 0 ? validSlides : normalizedSlides;

  return {
    cached: data.cached || false,
    blocked: data.blocked || false,
    answer: data.answer || '',
    presentationSlides: slidesToUse,
    latexFormulas: data.latexFormulas || data.latex_formulas || [],
    keyPoints: data.keyPoints || data.key_points || [],
    followUpQuestions: data.followUpQuestions || data.follow_up_questions || [],
    narrationText: data.narrationText || data.narration_text || data.answer || '',
    subjectName: data.subjectName || data.subject_name,
    detectedTopic: data.detected_topic || data.detectedTopic,
    relatedConcepts: data.related_concepts || data.relatedConcepts || [],
    cacheId: data.cache_id || data.cacheId,
    slideAudioUrls: (data.slide_audio_urls || data.slideAudioUrls || data.audio_urls || data.audioUrls || (Array.isArray(data.presentationSlides)
      ? data.presentationSlides
          .map((s: any, i: number) => {
            const audioUrl = s?.audioUrl || s?.audio_url;
            return audioUrl ? { slideIndex: i, audioUrl, duration: s.duration || s.durationSeconds || s.duration_seconds || 0 } : null;
          })
          .filter(Boolean)
      : [])),
    totalDurationSeconds: data.total_duration_seconds || data.totalDurationSeconds || 0,
    matchedFromLecture: data.matchedFromLecture || data.matched_from_lecture || false,
    matchedPresentationData: data.matchedPresentationData || data.matched_presentation_data || null,
    semanticMatch: data.semantic_match || data.semanticMatch || false,
    matchedQuestion: data.matched_question || data.matchedQuestion || null,
    matchConfidence: data.match_confidence || data.matchConfidence || 0,
  };
}

// --- Types ------------------------------------------------------------------
export interface AIJobParams {
  question: string;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  language?: string;
  subjectName?: string;
  userTier?: 'free' | 'pro';
  returnPath: string; // page to return to
}

export interface AIJob {
  id: string;
  status: 'pending' | 'ready' | 'error';
  question: string;
  params: AIJobParams;
  response?: TeachingResponse | null;
  error?: string;
  requiresConfirmation: boolean; // true if response arrived while AI tab not active
  presentationStarted: boolean; // true once the user has begun watching the presentation
  startedAt: number;
  finishedAt?: number;
}

interface Ctx {
  job: AIJob | null;
  isActive: boolean;
  startJob: (params: AIJobParams) => Promise<TeachingResponse | null>;
  markActive: () => void;
  markInactive: () => void;
  acknowledgeAndConfirm: () => void; // user clicked "Start presentation" — flips requiresConfirmation off
  markPresentationStarted: () => void; // user is now watching — disables the "ready" nav gate
  clearJob: () => void;
}

const AIAssistantJobContext = createContext<Ctx | null>(null);

export function AIAssistantJobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<AIJob | null>(null);
  const activeRef = useRef(false);
  const [, force] = useState(0);

  const markActive = useCallback(() => {
    activeRef.current = true;
    force(n => n + 1);
  }, []);
  const markInactive = useCallback(() => {
    activeRef.current = false;
    force(n => n + 1);
  }, []);

  const clearJob = useCallback(() => {
    console.log('[AIGate] clearJob called');
    setJob(null);
  }, []);

  const acknowledgeAndConfirm = useCallback(() => {
    console.log('[AIGate] acknowledgeAndConfirm called');
    setJob(j => (j ? { ...j, requiresConfirmation: false } : j));
  }, []);

  const markPresentationStarted = useCallback(() => {
    setJob(j => {
      if (!j) { console.log('[AIGate] markPresentationStarted: no job'); return j; }
      if (j.presentationStarted) return j;
      console.log('[AIGate] markPresentationStarted: flipping to true', { jobId: j.id });
      return { ...j, presentationStarted: true, requiresConfirmation: false };
    });
  }, []);

  const startJob = useCallback(async (params: AIJobParams): Promise<TeachingResponse | null> => {
    const id = `aijob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newJob: AIJob = {
      id,
      status: 'pending',
      question: params.question,
      params,
      requiresConfirmation: false,
      presentationStarted: false,
      startedAt: Date.now(),
    };
    setJob(newJob);

    try {
      // Single source of truth: CPU server via /ai-teaching-assistant.
      // The CPU already returns pre-generated answers when available
      // (data.cached === true / semantic_match), so no separate Supabase
      // cache lookup is needed.
      const { data: liveData, error } = await invokeAiTeachingAssistantDirect({
        mode: 'full',
        question: params.question,
        subjectName: params.subjectName,
        subjectId: params.subjectId ?? params.topicId ?? params.chapterId,
        language: params.language || 'en-US',
        userTier: params.userTier || 'pro',
      });
      if (error) throw error;
      if (liveData?.error) throw new Error(liveData.error);
      const data = liveData;

      const normalized = normalizeResponse(data);
      // Was the AI tab active when we got the answer?
      const wasActive = activeRef.current;
      console.log('[AIGate] startJob response ready', {
        jobId: id,
        wasActive,
        blocked: !!normalized.blocked,
        cached: !!normalized.cached,
        requiresConfirmation: !wasActive && !normalized.blocked,
      });
      setJob(j => j && j.id === id ? {
        ...j,
        status: 'ready',
        response: normalized,
        // Only require confirmation if user navigated away during processing.
        // Blocked (off-subject) responses skip the gate — they have no presentation to start.
        requiresConfirmation: !wasActive && !normalized.blocked,
        finishedAt: Date.now(),
      } : j);
      return normalized;
    } catch (e: any) {
      const message = e?.message || 'Failed to get response from AI tutor';
      setJob(j => j && j.id === id ? { ...j, status: 'error', error: message, finishedAt: Date.now() } : j);
      return null;
    }
  }, []);

  // Auto-expire stale ready jobs after 15 min
  useEffect(() => {
    if (!job || job.status !== 'ready' || !job.requiresConfirmation) return;
    const timer = setTimeout(() => {
      setJob(j => (j && j.id === job.id ? null : j));
    }, 15 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [job]);

  return (
    <AIAssistantJobContext.Provider
      value={{
        job,
        isActive: activeRef.current,
        startJob,
        markActive,
        markInactive,
        acknowledgeAndConfirm,
        markPresentationStarted,
        clearJob,
      }}
    >
      {children}
    </AIAssistantJobContext.Provider>
  );
}

export function useAIAssistantJob() {
  const ctx = useContext(AIAssistantJobContext);
  if (!ctx) throw new Error('useAIAssistantJob must be used inside AIAssistantJobProvider');
  return ctx;
}
