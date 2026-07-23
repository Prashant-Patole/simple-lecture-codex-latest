import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseUrl';

export type SupportedLanguage = 
  | 'hi-IN' | 'bn-IN' | 'ta-IN' | 'te-IN' 
  | 'mr-IN' | 'gu-IN' | 'kn-IN' | 'ml-IN' | 'pa-IN';

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, { name: string; flag: string }> = {
  'hi-IN': { name: 'Hindi', flag: '🇮🇳' },
  'bn-IN': { name: 'Bengali', flag: '🇮🇳' },
  'ta-IN': { name: 'Tamil', flag: '🇮🇳' },
  'te-IN': { name: 'Telugu', flag: '🇮🇳' },
  'mr-IN': { name: 'Marathi', flag: '🇮🇳' },
  'gu-IN': { name: 'Gujarati', flag: '🇮🇳' },
  'kn-IN': { name: 'Kannada', flag: '🇮🇳' },
  'ml-IN': { name: 'Malayalam', flag: '🇮🇳' },
  'pa-IN': { name: 'Punjabi', flag: '🇮🇳' },
};

interface CachedAudio {
  audioBlob: Blob;
  duration: number;
  timestamp: number;
}

interface UseIndicParlerTTSReturn {
  speak: (text: string, languageCode?: SupportedLanguage, onComplete?: () => void) => Promise<void>;
  speakFromCache: (text: string, languageCode?: SupportedLanguage, onComplete?: () => void) => Promise<{ ok: boolean; reason?: string }>;
  precacheAudio: (text: string, languageCode?: SupportedLanguage) => Promise<CachedAudio | null>;
  precacheAllSlides: (
    slides: Array<{ narration?: string; content?: string }>,
    languageCode?: SupportedLanguage,
    onProgress?: (current: number, total: number) => void
  ) => Promise<{ success: boolean; cached: number; failed: number; totalDuration: number }>;
  stopSpeaking: () => void;
  clearCache: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
}

// Audio cache with 30-minute TTL
const audioCache = new Map<string, CachedAudio>();
const CACHE_TTL = 30 * 60 * 1000;

// Clear expired cache entries
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of audioCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      audioCache.delete(key);
    }
  }
}

// Generate cache key
function getCacheKey(text: string, languageCode: SupportedLanguage): string {
  return `${languageCode}:${text.trim().substring(0, 200)}`;
}

export function useIndicParlerTTS(): UseIndicParlerTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Stop any currently playing audio
  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Clear all cached audio
  const clearCache = useCallback(() => {
    audioCache.clear();
  }, []);

  // Fetch audio from edge function (returns binary WAV)
  const fetchAudio = async (
    text: string,
    languageCode: SupportedLanguage
  ): Promise<{ audioBlob: Blob; duration: number } | null> => {
    try {
      console.log(`[Indic Parler] Fetching audio for: "${text.substring(0, 50)}..."`);

      const { data, error: invokeError } = await supabase.functions.invoke('indic-parler-tts', {
        body: { text, languageCode },
      });

      // Check if we got an error response
      if (invokeError) {
        console.error('[Indic Parler] Function error:', invokeError);
        return null;
      }

      // supabase.functions.invoke returns data as the response
      // For binary responses, we need to handle it differently
      let audioBlob: Blob;

      if (data instanceof Blob) {
        audioBlob = data;
      } else if (data instanceof ArrayBuffer) {
        audioBlob = new Blob([data], { type: 'audio/wav' });
      } else if (typeof data === 'object' && data.error) {
        console.error('[Indic Parler] API error:', data.error);
        return null;
      } else {
        // Try to get raw response - fallback to direct fetch
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/indic-parler-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ text, languageCode }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[Indic Parler] Fetch error:', errorData);
          return null;
        }

        const contentType = response.headers.get('Content-Type');
        if (contentType?.includes('audio/')) {
          audioBlob = await response.blob();
        } else {
          console.error('[Indic Parler] Unexpected content type:', contentType);
          return null;
        }
      }

      // Calculate duration from audio
      const duration = await getAudioDuration(audioBlob);
      console.log(`[Indic Parler] Audio fetched, duration: ${duration.toFixed(2)}s`);

      return { audioBlob, duration };
    } catch (err) {
      console.error('[Indic Parler] Fetch error:', err);
      return null;
    }
  };

  // Get audio duration from blob
  const getAudioDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration || 0);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(0);
      });
      
      audio.src = url;
    });
  };

  // Play audio from blob
  const playAudioBlob = (
    blob: Blob,
    onComplete?: () => void
  ): Promise<{ ok: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      stopSpeaking();

      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.addEventListener('ended', () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        currentAudioRef.current = null;
        onComplete?.();
        resolve({ ok: true });
      });

      audio.addEventListener('error', (e) => {
        console.error('[Indic Parler] Audio playback error:', e);
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        currentAudioRef.current = null;
        resolve({ ok: false, reason: 'playback_error' });
      });

      setIsSpeaking(true);
      
      audio.play().catch((playError) => {
        console.error('[Indic Parler] Play error:', playError);
        setIsSpeaking(false);
        
        // Check for autoplay blocking
        if (playError.name === 'NotAllowedError') {
          resolve({ ok: false, reason: 'autoplay_blocked' });
        } else {
          resolve({ ok: false, reason: 'play_failed' });
        }
      });
    });
  };

  // Precache audio for a single text
  const precacheAudio = useCallback(async (
    text: string,
    languageCode: SupportedLanguage = 'hi-IN'
  ): Promise<CachedAudio | null> => {
    cleanExpiredCache();

    const cacheKey = getCacheKey(text, languageCode);
    
    // Check if already cached
    const cached = audioCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Indic Parler] Cache hit for: "${text.substring(0, 30)}..."`);
      return cached;
    }

    // Fetch and cache
    const result = await fetchAudio(text, languageCode);
    if (!result) return null;

    const cacheEntry: CachedAudio = {
      audioBlob: result.audioBlob,
      duration: result.duration,
      timestamp: Date.now(),
    };

    audioCache.set(cacheKey, cacheEntry);
    console.log(`[Indic Parler] Cached audio for: "${text.substring(0, 30)}..."`);

    return cacheEntry;
  }, []);

  // Precache all slides
  const precacheAllSlides = useCallback(async (
    slides: Array<{ narration?: string; content?: string }>,
    languageCode: SupportedLanguage = 'hi-IN',
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; cached: number; failed: number; totalDuration: number }> => {
    const textsToCache = slides
      .map((slide) => slide.narration || slide.content || '')
      .filter((text) => text.trim().length > 0);

    let cached = 0;
    let failed = 0;
    let totalDuration = 0;

    for (let i = 0; i < textsToCache.length; i++) {
      onProgress?.(i + 1, textsToCache.length);
      
      const result = await precacheAudio(textsToCache[i], languageCode);
      if (result) {
        cached++;
        totalDuration += result.duration;
      } else {
        failed++;
      }
    }

    console.log(`[Indic Parler] Precaching complete: ${cached} cached, ${failed} failed, total duration: ${totalDuration.toFixed(1)}s`);

    return {
      success: failed === 0,
      cached,
      failed,
      totalDuration,
    };
  }, [precacheAudio]);

  // Speak from cache (returns status)
  const speakFromCache = useCallback(async (
    text: string,
    languageCode: SupportedLanguage = 'hi-IN',
    onComplete?: () => void
  ): Promise<{ ok: boolean; reason?: string }> => {
    const cacheKey = getCacheKey(text, languageCode);
    const cached = audioCache.get(cacheKey);

    if (!cached) {
      console.warn(`[Indic Parler] No cached audio for: "${text.substring(0, 30)}..."`);
      return { ok: false, reason: 'not_cached' };
    }

    return playAudioBlob(cached.audioBlob, onComplete);
  }, [stopSpeaking]);

  // Speak text (fetch if not cached)
  const speak = useCallback(async (
    text: string,
    languageCode: SupportedLanguage = 'hi-IN',
    onComplete?: () => void
  ): Promise<void> => {
    if (!text.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      // Try from cache first
      const cacheKey = getCacheKey(text, languageCode);
      let cached = audioCache.get(cacheKey);

      if (!cached || Date.now() - cached.timestamp > CACHE_TTL) {
        // Fetch fresh audio
        const result = await fetchAudio(text, languageCode);
        if (!result) {
          setError('Failed to generate audio');
          setIsLoading(false);
          onComplete?.();
          return;
        }

        cached = {
          audioBlob: result.audioBlob,
          duration: result.duration,
          timestamp: Date.now(),
        };
        audioCache.set(cacheKey, cached);
      }

      setIsLoading(false);
      await playAudioBlob(cached.audioBlob, onComplete);
    } catch (err) {
      console.error('[Indic Parler] Speak error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
      onComplete?.();
    }
  }, [stopSpeaking]);

  return {
    speak,
    speakFromCache,
    precacheAudio,
    precacheAllSlides,
    stopSpeaking,
    clearCache,
    isSpeaking,
    isLoading,
    error,
  };
}

export function clearAudioCache() {
  audioCache.clear();
}
