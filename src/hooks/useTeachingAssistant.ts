import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_DIRECT_URL } from '@/lib/supabaseUrl';
import { useToast } from '@/hooks/use-toast';
import { useAIAssistantJob } from '@/contexts/AIAssistantJobContext';

/**
 * Direct invoke for ai-teaching-assistant — bypasses Cloudflare Worker proxy
 * (which has a 150s idle timeout) and goes straight to Supabase, giving us
 * the full 400s edge-function budget (Supabase Pro).
 */
async function invokeAiTeachingAssistantDirect(body: any): Promise<{ data: any; error: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 420_000); // 420s
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    const res = await fetch(`${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apikey,
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
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
    const message = err?.name === 'AbortError'
      ? 'Request timed out after 420 seconds'
      : (err?.message || 'Network error');
    return { data: null, error: { message } };
  } finally {
    clearTimeout(timeoutId);
  }
}


export interface DetectedTopic {
  detected_topic: string;
  description: string;
  related_concepts: string[];
  confidence: number;
}

export interface PresentationSlide {
  title: string;
  content: string;
  keyPoints?: string[];
  formula?: string;
  narration?: string;
  isStory?: boolean;
  isTips?: boolean;
  infographic?: string;
  infographicUrl?: string;
  videoUrl?: string;
}

export interface LatexFormula {
  formula: string;
  explanation: string;
}

export interface SlideAudioUrl {
  slideIndex: number;
  audioUrl: string;
  duration?: number;       // Primary field (from database)
  durationSeconds?: number; // Legacy support
}

export interface TeachingResponse {
  cached: boolean;
  blocked?: boolean;  // true if subject mismatch redirect
  // Off-subject metadata (only present when blocked === true)
  message?: string;
  currentSubject?: string;
  detectedSubject?: string | null;
  reason?: string;
  answer: string;
  presentationSlides: PresentationSlide[];
  latexFormulas: LatexFormula[];
  keyPoints?: string[];
  followUpQuestions?: string[];
  narrationText: string;
  subjectName?: string;
  // Topic detection included in main response
  detectedTopic?: string;
  relatedConcepts?: string[];
  // Cache ID for saving audio to storage
  cacheId?: string;
  // Pre-saved audio URLs from B2 (for cached responses)
  slideAudioUrls?: SlideAudioUrl[];
  totalDurationSeconds?: number;
  // NEW: Lecture section matching - when answer matches existing AI lecture
  matchedFromLecture?: boolean;
  matchedPresentationData?: any;  // Mini presentation.json with matched section(s)
  // NEW: Semantic matching - when question matches a semantically similar cached question
  semanticMatch?: boolean;
  matchedQuestion?: string;
  matchConfidence?: number;
}

export function useTeachingAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [localResponse, setLocalResponse] = useState<TeachingResponse | null>(null);
  const { toast } = useToast();
  const jobCtx = useAIAssistantJob();

  // currentResponse comes from either the background job (preferred — survives unmount)
  // or a local doubt-mode call. When the job still requires user confirmation, hide it
  // so AITeachingAssistant can show its "Start presentation" gate first.
  const jobResponse =
    jobCtx.job && jobCtx.job.status === 'ready' && !jobCtx.job.requiresConfirmation
      ? jobCtx.job.response ?? null
      : null;
  const currentResponse: TeachingResponse | null = jobResponse ?? localResponse;

  // askQuestion delegates to the global job context so the request keeps running
  // even if the user switches tabs or navigates away. Normalization happens inside
  // the context. The returned response is also injected into local state so the
  // existing handleSend choreography sees it synchronously when the component is
  // still mounted.
  const askQuestion = useCallback(async (
    question: string,
    topicId?: string,
    chapterId?: string,
    language: string = 'en-US',
    subjectName?: string,
    subjectId?: string,
    userTier: 'free' | 'pro' = 'pro',
  ): Promise<TeachingResponse | null> => {
    if (!question.trim()) {
      toast({
        title: "Question Required",
        description: "Please enter a question to ask the AI tutor.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    try {
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
      const sp = new URLSearchParams();
      if (subjectId) sp.set('subject', subjectId);
      if (chapterId) sp.set('chapter', chapterId);
      if (topicId) sp.set('topic', topicId);
      sp.set('tab', 'ai-assistant');
      const returnPath = `${pathname}?${sp.toString()}`;
      const response = await jobCtx.startJob({
        question,
        topicId,
        chapterId,
        subjectId,
        language,
        subjectName,
        userTier,
        returnPath,
      });
      if (!response) {
        toast({
          title: "Error",
          description: "Failed to get response from AI tutor",
          variant: "destructive",
        });
        return null;
      }
      // Keep local mirror only if the answer is auto-consumable (user stayed on the AI tab).
      // If the job requires confirmation, the inline gate in AITeachingAssistant will drive consumption.
      return response;
    } finally {
      setIsLoading(false);
    }
  }, [toast, jobCtx]);

  const clearResponse = useCallback(() => {
    setLocalResponse(null);
    jobCtx.clearJob();
  }, [jobCtx]);


  const fetchHistory = useCallback(async (topicId?: string, chapterId?: string) => {
    try {
      let query = supabase
        .from('teaching_qa_cache')
        .select('id, question_text, answer_text, presentation_slides, created_at, language')
        .order('created_at', { ascending: false })
        .limit(20);

      if (topicId) {
        query = query.eq('topic_id', topicId);
      } else if (chapterId) {
        query = query.eq('chapter_id', chapterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }, []);

  const detectTopic = useCallback(async (
    question: string,
    subjectName?: string,
    userTier: 'free' | 'pro' = 'pro',
  ): Promise<DetectedTopic | null> => {
    try {
      const { data, error } = await invokeAiTeachingAssistantDirect({
        question, subjectName, userTier, mode: 'detect_topic'
      });

      if (error) {
        console.error('[detectTopic] Error:', error);
        return null;
      }

      return data as DetectedTopic;
    } catch (error) {
      console.error('[detectTopic] Exception:', error);
      return null;
    }
  }, []);

  // Specialized method for doubt explanations (1 slide, focused content)
  const askDoubtQuestion = useCallback(async (
    questionText: string,
    correctAnswer: string,
    studentAnswer: string,
    topicId?: string,
    chapterId?: string,
    subjectName?: string,
    userTier: 'free' | 'pro' = 'pro',
  ): Promise<TeachingResponse | null> => {
    if (!questionText.trim()) {
      toast({
        title: "Question Required",
        description: "No question text provided for doubt explanation.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    try {
      const { data, error } = await invokeAiTeachingAssistantDirect({
        mode: 'doubt',
        questionText,
        correctAnswer,
        studentAnswer,
        topicId,
        chapterId,
        subjectName,
        userTier,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      console.log('[askDoubtQuestion] Response:', JSON.stringify(data).substring(0, 500));

      // Normalize the doubt response (single slide)
      const normalizedSlides: PresentationSlide[] = (data.presentationSlides || []).map((slide: any) => ({
        title: slide.title || 'Understanding the Concept',
        content: slide.content || '',
        keyPoints: slide.keyPoints || slide.key_points || [],
        formula: slide.formula || null,
        narration: slide.narration || slide.content || '',
        isStory: false,
        isTips: false,
        infographic: slide.infographic || null,
        infographicUrl: slide.infographicUrl || slide.infographic_url || null,
        videoUrl: null,
      }));

      const response: TeachingResponse = {
        cached: data.cached || false,
        blocked: false,
        answer: data.answer || '',
        presentationSlides: normalizedSlides,
        latexFormulas: data.latexFormulas || data.latex_formulas || [],
        keyPoints: data.keyPoints || data.key_points || [],
        followUpQuestions: [],
        narrationText: normalizedSlides[0]?.narration || data.answer || '',
        subjectName: subjectName,
        cacheId: data.cache_id || data.cacheId,
        slideAudioUrls: [],
        totalDurationSeconds: 0,
      };

      setLocalResponse(response);
      
      if (response.cached) {
        console.log('[askDoubtQuestion] Doubt explanation served from cache');
      }

      return response;
    } catch (error) {
      console.error('Doubt explanation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get doubt explanation",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isLoading,
    currentResponse,
    askQuestion,
    askDoubtQuestion,
    clearResponse,
    fetchHistory,
    detectTopic,
    injectResponse: setLocalResponse,
  };
}
