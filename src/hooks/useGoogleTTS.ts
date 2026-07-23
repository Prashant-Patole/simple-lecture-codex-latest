import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Supported Indian languages with their display names (14 languages from Bharat TTS)
export const SUPPORTED_LANGUAGES = {
  'en-IN': { name: 'English (India)', flag: '🇬🇧', shortName: 'English' },
  'hi-IN': { name: 'Hindi', flag: '🇮🇳', shortName: 'हिंदी' },
  'ta-IN': { name: 'Tamil', flag: '🇮🇳', shortName: 'தமிழ்' },
  'te-IN': { name: 'Telugu', flag: '🇮🇳', shortName: 'తెలుగు' },
  'kn-IN': { name: 'Kannada', flag: '🇮🇳', shortName: 'ಕನ್ನಡ' },
  'ml-IN': { name: 'Malayalam', flag: '🇮🇳', shortName: 'മലയാളം' },
  'bn-IN': { name: 'Bengali', flag: '🇮🇳', shortName: 'বাংলা' },
  'mr-IN': { name: 'Marathi', flag: '🇮🇳', shortName: 'मराठी' },
  'gu-IN': { name: 'Gujarati', flag: '🇮🇳', shortName: 'ગુજરાતી' },
  'pa-IN': { name: 'Punjabi', flag: '🇮🇳', shortName: 'ਪੰਜਾਬੀ' },
  'or-IN': { name: 'Odia', flag: '🇮🇳', shortName: 'ଓଡ଼ିଆ' },
  'ur-IN': { name: 'Urdu', flag: '🇮🇳', shortName: 'اردو' },
  'as-IN': { name: 'Assamese', flag: '🇮🇳', shortName: 'অসমীয়া' },
  'sa-IN': { name: 'Sanskrit', flag: '🇮🇳', shortName: 'संस्कृत' },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Function to clear audio cache for language switching
export const clearAudioCache = () => {
  audioCache.clear();
  console.log('🗑️ Audio cache cleared for language switch');
};

// Helper to convert LaTeX formulas to speakable text
const convertLatexToSpeakable = (latex: string): string => {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 divided by $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    .replace(/\\sum/g, 'sum of')
    .replace(/\\int/g, 'integral of')
    .replace(/\^2/g, ' squared')
    .replace(/\^3/g, ' cubed')
    .replace(/\^{([^}]+)}/g, ' to the power of $1')
    .replace(/\^(\d)/g, ' to the power of $1')
    .replace(/_\{([^}]+)\}/g, ' subscript $1')
    .replace(/_(\d)/g, ' subscript $1')
    .replace(/\\times/g, ' times ')
    .replace(/\\div/g, ' divided by ')
    .replace(/\\pm/g, ' plus or minus ')
    .replace(/\\pi/g, 'pi')
    .replace(/\\theta/g, 'theta')
    .replace(/\\alpha/g, 'alpha')
    .replace(/\\beta/g, 'beta')
    .replace(/\\gamma/g, 'gamma')
    .replace(/\\Delta/g, 'delta')
    .replace(/\\infty/g, 'infinity')
    .replace(/\\neq/g, ' not equal to ')
    .replace(/\\leq/g, ' less than or equal to ')
    .replace(/\\geq/g, ' greater than or equal to ')
    .replace(/\\cdot/g, ' times ')
    .replace(/\\[a-zA-Z]+/g, '') // Remove remaining LaTeX commands
    .replace(/[{}]/g, '') // Remove braces
    .trim();
};

// Helper to clean text for cache key matching (exported for external use)
const cleanTextForTTSInternal = (text: string): string => {
  return text
    .replace(/\[LANG:\w{2}-IN\]\s*/g, '')
    // Convert LaTeX math to speakable text
    .replace(/\$\$(.*?)\$\$/gs, (_, formula) => convertLatexToSpeakable(formula))
    .replace(/\$(.*?)\$/g, (_, formula) => convertLatexToSpeakable(formula))
    .replace(/\\\((.*?)\\\)/g, (_, formula) => convertLatexToSpeakable(formula))
    .replace(/\\\[(.*?)\\\]/gs, (_, formula) => convertLatexToSpeakable(formula))
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/["""''`]/g, '')
    .replace(/[_~]/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, '. ')
    .trim();
};

// Generate cache key (exported for external matching)
const getCacheKeyInternal = (text: string, lang: string, gender: string) => 
  `${lang}:${gender}:${text.substring(0, 100)}`;

// Export function to retrieve cached audio for a slide narration
export const getAudioFromCache = (
  text: string, 
  languageCode: string, 
  gender: "female" | "male" = "male"
): { blob?: Blob; base64Contents?: string[] } | null => {
  const cleanText = cleanTextForTTSInternal(text);
  if (!cleanText) return null;
  
  const cacheKey = getCacheKeyInternal(cleanText, languageCode, gender);
  const cached = audioCache.get(cacheKey);
  
  if (!cached) return null;
  
  return {
    blob: cached.audioBlob,
    base64Contents: cached.audioContents
  };
};

// Parallel TTS requests - process 3 at a time for faster audio preparation
const MAX_CONCURRENT_TTS_REQUESTS = 3;

let activeTTSRequests = 0;
const ttsWaitQueue: Array<() => void> = [];

const acquireTTSSlot = async () => {
  if (activeTTSRequests < MAX_CONCURRENT_TTS_REQUESTS) {
    activeTTSRequests++;
    return;
  }
  await new Promise<void>((resolve) => {
    ttsWaitQueue.push(() => {
      activeTTSRequests++;
      resolve();
    });
  });
};

const releaseTTSSlot = () => {
  activeTTSRequests = Math.max(0, activeTTSRequests - 1);
  const next = ttsWaitQueue.shift();
  if (next) next();
};

// No artificial delays - just concurrency limit
const queueTTSRequest = async <T>(fn: () => Promise<T>): Promise<T> => {
  await acquireTTSSlot();
  try {
    return await fn();
  } finally {
    releaseTTSSlot();
  }
};

interface PrecacheResult {
  success: boolean;
  totalDurationSeconds: number;
}

interface UseGoogleTTSReturn {
  speak: (text: string, languageCode?: SupportedLanguage, gender?: "female" | "male", onComplete?: () => void) => Promise<void>;
  speakFromCache: (
    text: string,
    languageCode?: SupportedLanguage,
    gender?: "female" | "male",
    onComplete?: () => void,
    onProgress?: (progress: { currentTime: number; duration: number; progress: number }) => void
  ) => Promise<boolean>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
  // Pre-cache function for audio pre-generation - returns cached audio object or null
  precacheAudio: (text: string, languageCode?: SupportedLanguage, gender?: "female" | "male") => Promise<CachedAudio | null>;
  // Batch pre-cache all slides audio with progress callback - returns actual audio duration
  precacheAllSlides: (
    slides: Array<{ narration?: string; content?: string }>,
    languageCode?: SupportedLanguage,
    gender?: "female" | "male",
    onProgress?: (current: number, total: number) => void
  ) => Promise<PrecacheResult>;
}

// Audio cache for pre-generated audio - stores Blob directly (no base64)
interface CachedAudio {
  audioBlob?: Blob;           // Direct binary blob (preferred - Indic Parler)
  audioContents?: string[];   // Legacy base64 encoded audio data (fallback TTS services)
  mimeType: string;
  timestamp: number;
  duration?: number;          // Cached duration in seconds
}
const audioCache = new Map<string, CachedAudio>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL (longer since we invested in fetching)

export const useGoogleTTS = (): UseGoogleTTSReturn => {
  // All hooks must be called first, unconditionally
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);
  const hasUserInteractionRef = useRef(false);

  // Track user interaction for browser autoplay policy
  const markUserInteraction = () => {
    if (!hasUserInteractionRef.current) {
      console.log("✅ User interaction detected - audio playback enabled");
      hasUserInteractionRef.current = true;
    }
  };

  // Unlock audio context on user interaction
  const unlockAudioContext = async () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      // Create a short silent buffer to fully unlock
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
      audioContext.close();
      console.log("🔊 Audio context unlocked");
      return true;
    } catch (err) {
      console.warn("Failed to unlock audio context:", err);
      return false;
    }
  };

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true; // Mark as intentionally stopped
    // Stop OpenAI TTS audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Cleanup effect - stop audio if component using this hook unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Helper function to split text into chunks under max length
  const splitTextIntoChunks = (text: string, maxLength: number = 3800): string[] => {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good break point (sentence end, comma, or space)
      let breakPoint = maxLength;
      
      // Try to find sentence end
      const sentenceEnd = remaining.lastIndexOf('. ', maxLength);
      if (sentenceEnd > maxLength * 0.5) {
        breakPoint = sentenceEnd + 1;
      } else {
        // Try comma
        const commaEnd = remaining.lastIndexOf(', ', maxLength);
        if (commaEnd > maxLength * 0.5) {
          breakPoint = commaEnd + 1;
        } else {
          // Try space
          const spaceEnd = remaining.lastIndexOf(' ', maxLength);
          if (spaceEnd > maxLength * 0.3) {
            breakPoint = spaceEnd;
          }
        }
      }
      
      chunks.push(remaining.substring(0, breakPoint).trim());
      remaining = remaining.substring(breakPoint).trim();
    }
    
    return chunks;
  };

  // Clean text helper - uses the internal function with LaTeX support
  const cleanTextForTTS = (text: string): string => {
    return cleanTextForTTSInternal(text);
  };

  // Generate cache key
  const getCacheKey = (text: string, lang: string, gender: string) => 
    `${lang}:${gender}:${text.substring(0, 100)}`;

  // Translate text to target language (if not English)
  const translateText = async (
    text: string,
    targetLanguage: SupportedLanguage
  ): Promise<string> => {
    // No translation needed for English
    if (targetLanguage === 'en-IN') {
      return text;
    }

    console.log(`🌐 Translating to ${SUPPORTED_LANGUAGES[targetLanguage].name}...`);
    
    try {
      const response = await supabase.functions.invoke('translate-text', {
        body: { text, targetLanguage }
      });

      if (response.error) {
        console.warn('⚠️ Translation failed:', response.error.message);
        return text; // Return original text on failure
      }

      if (response.data?.translatedText) {
        console.log(`✅ Translation success`);
        return response.data.translatedText;
      }

      return text;
    } catch (err) {
      console.warn('⚠️ Translation error:', err);
      return text;
    }
  };

  // Get voice description for Indic-Parler-TTS
  const getVoiceDescription = (languageCode: SupportedLanguage): string => {
    if (languageCode === 'hi-IN') {
      return "Divya speaks clearly with very clear audio and moderate speed";
    }
    return "A female speaker with a clear voice delivers her words at a moderate pace in a small room with minimal reverb.";
  };

  // Fetch audio from TTS - Indic-Parler (primary) with Sarvam fallback
  const fetchAudioFromTTS = async (
    chunk: string, 
    languageCode: SupportedLanguage, 
    gender: "female" | "male"
  ): Promise<CachedAudio | null> => {
    // Use global queue to limit concurrent requests
    return queueTTSRequest(async () => {
      console.log(`🔄 TTS request starting for ${languageCode}...`);
      
      try {
        // Use Sarvam TTS (primary)
        console.log('🎯 Using Sarvam TTS...');
        const sarvamResponse = await supabase.functions.invoke('sarvam-tts', {
          body: { text: chunk, languageCode, gender },
        });

        if (!sarvamResponse.error && sarvamResponse.data?.audioContent) {
          let audioContents: string[];
          if (sarvamResponse.data.isChunked && Array.isArray(sarvamResponse.data.audioContent)) {
            audioContents = sarvamResponse.data.audioContent;
          } else {
            audioContents = [sarvamResponse.data.audioContent];
          }
          console.log(`✅ Sarvam TTS success (${audioContents.length} segments)`);
          return { audioContents, mimeType: 'audio/wav', timestamp: Date.now() };
        }
        
        console.warn('⚠️ Sarvam TTS failed:', sarvamResponse.error?.message || sarvamResponse.data?.error);
        return null;
      } catch (err) {
        console.warn('⚠️ TTS error:', err);
        return null;
      }
    });
  };

  // Get audio duration from Blob
  const getBlobAudioDuration = (blob: Blob): Promise<number> => {
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
      
      // Timeout fallback
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(0);
      }, 3000);
      
      audio.src = url;
    });
  };

  // Pre-cache audio for upcoming slides (background generation)
  // NEW: Translates English text to target language before TTS for regional narration
  const precacheAudio = useCallback(async (
    text: string,
    languageCode: SupportedLanguage = 'en-IN',
    gender: "female" | "male" = "male"
  ): Promise<CachedAudio | null> => {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText) return null;

    const cacheKey = getCacheKey(cleanText, languageCode, gender);
    
    // Check if already cached
    const cached = audioCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📦 Audio already cached for: "${cleanText.substring(0, 30)}..."`);
      return cached;
    }

    // Translate to target language if not English (slides stay in English, narration is translated)
    let textForTTS = cleanText;
    if (languageCode !== 'en-IN') {
      console.log(`🌐 Translating for TTS: "${cleanText.substring(0, 40)}..." → ${SUPPORTED_LANGUAGES[languageCode].name}`);
      textForTTS = await translateText(cleanText, languageCode);
    }

    console.log(`🔄 Pre-caching audio for: "${textForTTS.substring(0, 30)}..." in ${SUPPORTED_LANGUAGES[languageCode].name}`);
    
    const result = await fetchAudioFromTTS(textForTTS, languageCode, gender);
    if (result) {
      audioCache.set(cacheKey, result);
      return result;
    }
    return null;
  }, [translateText]);

  // Helper to get audio duration from cached content (Blob or base64)
  const getAudioDuration = async (cached: CachedAudio): Promise<number> => {
    // If we have direct blob (Indic Parler), use it
    if (cached.audioBlob) {
      return getBlobAudioDuration(cached.audioBlob);
    }
    
    // Otherwise calculate from base64 contents (Sarvam fallback)
    let totalDuration = 0;
    
    if (cached.audioContents && cached.audioContents.length > 0) {
      for (const audioContent of cached.audioContents) {
        try {
          const blob = base64ToBlob(audioContent, cached.mimeType);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          
          await new Promise<void>((resolve) => {
            audio.onloadedmetadata = () => {
              totalDuration += audio.duration || 0;
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            setTimeout(() => {
              URL.revokeObjectURL(url);
              resolve();
            }, 2000);
          });
        } catch (err) {
          console.warn('Failed to get audio duration:', err);
        }
      }
    }
    
    return totalDuration;
  };

  // Batch pre-cache all slides audio with progress callback - returns actual audio duration
  // Now processes in parallel batches of 3 for faster preparation
  const precacheAllSlides = useCallback(async (
    slides: Array<{ narration?: string; content?: string }>,
    languageCode: SupportedLanguage = 'en-IN',
    gender: "female" | "male" = "male",
    onProgress?: (current: number, total: number) => void
  ): Promise<PrecacheResult> => {
    const total = slides.length;
    let completed = 0;
    let totalDurationSeconds = 0;
    const BATCH_SIZE = 3; // Process 3 slides at a time

    console.log(`🎵 Pre-caching audio for ${total} slides (parallel batches of ${BATCH_SIZE})...`);

    // Process slides in batches of 3
    for (let batchStart = 0; batchStart < slides.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, slides.length);
      const batch = slides.slice(batchStart, batchEnd);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (slide, batchIndex) => {
          const slideIndex = batchStart + batchIndex;
          const text = slide.narration || slide.content || '';
          let slideDuration = 0;

          if (text.trim()) {
            const result = await precacheAudio(text, languageCode, gender);
            if (!result) {
              console.warn(`⚠️ Failed to cache audio for slide ${slideIndex + 1}`);
            } else {
              slideDuration = result.duration ?? await getAudioDuration(result);
              if (slideDuration > 0) {
                console.log(`⏱️ Slide ${slideIndex + 1} duration: ${slideDuration.toFixed(1)}s`);
              }
            }
          }
          return slideDuration;
        })
      );
      
      // Update progress after batch completes
      completed += batch.length;
      onProgress?.(completed, total);
      
      // Sum durations from batch
      totalDurationSeconds += batchResults.reduce((sum, dur) => sum + dur, 0);
    }

    console.log(`✅ Audio pre-caching complete for ${total} slides. Total duration: ${totalDurationSeconds.toFixed(1)}s`);
    return { success: true, totalDurationSeconds };
  }, [precacheAudio]);

  const speak = useCallback(async (
    text: string,
    languageCode: SupportedLanguage = 'en-IN',
    gender: "female" | "male" = "female",
    onComplete?: () => void
  ) => {
    const cleanText = cleanTextForTTS(text);

    if (!cleanText) {
      console.log("No text to speak after cleaning");
      onComplete?.();
      return;
    }

    // Stop any currently playing audio
    stopSpeaking();

    // Check cache first
    const cacheKey = getCacheKey(cleanText, languageCode, gender);
    const cached = audioCache.get(cacheKey);
    
    // Split into chunks if text is too long
    const chunks = splitTextIntoChunks(cleanText, 3800);
    
    if (chunks.length > 1) {
      console.log(`🔊 TTS: Splitting text into ${chunks.length} chunks`);
    }

    setIsLoading(true);
    setError(null);
    stoppedRef.current = false; // Reset stopped flag

    try {
      // Process each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;
        
        // Translate English text to target language for TTS (slides stay English, voice is regional)
        let chunkForTTS = chunk;
        if (languageCode !== 'en-IN') {
          console.log(`🌐 Translating chunk ${i + 1} for TTS → ${SUPPORTED_LANGUAGES[languageCode].name}`);
          chunkForTTS = await translateText(chunk, languageCode);
        }
        
        console.log(`🔊 TTS: Speaking chunk ${i + 1}/${chunks.length} in ${languageCode}, gender: ${gender}, length: ${chunkForTTS.length}`);

        // Check cache for this specific chunk (use original English text as key, but with target language)
        const chunkCacheKey = getCacheKey(chunk, languageCode, gender);
        const cachedChunk = audioCache.get(chunkCacheKey);
        
        let audioData: CachedAudio | null = null;

        if (cachedChunk && Date.now() - cachedChunk.timestamp < CACHE_TTL) {
          console.log(`📦 Using cached audio for chunk ${i + 1}`);
          audioData = cachedChunk;
        } else {
          // Fetch from TTS services with translated text
          const result = await fetchAudioFromTTS(chunkForTTS, languageCode, gender);
          if (result) {
            audioData = result;
            // Cache for future use (key is original English + language)
            audioCache.set(chunkCacheKey, result);
          }
        }

        // Check if we have any audio to play (blob or base64)
        const hasAudio = audioData && (audioData.audioBlob || (audioData.audioContents && audioData.audioContents.length > 0));

        // If no real audio file/blob was returned, do not fall back to browser speech.
        if (!hasAudio) {
          console.warn('⚠️ No playable audio returned; skipping browser TTS fallback');
          setIsLoading(false);
          setIsSpeaking(false);
          continue;
        }

        // Check if stopped before playing
        if (stoppedRef.current) {
          setIsLoading(false);
          setIsSpeaking(false);
          return;
        }

        // Play audio from Blob (Indic-Parler) or base64 (Sarvam fallback)
        if (audioData!.audioBlob) {
          // Play WAV blob directly (Indic-Parler format)
          const audioUrl = URL.createObjectURL(audioData!.audioBlob);
          
          if (stoppedRef.current) {
            URL.revokeObjectURL(audioUrl);
            setIsLoading(false);
            setIsSpeaking(false);
            return;
          }

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onplay = () => {
              console.log(`▶️ TTS: WAV blob playing`);
              setIsSpeaking(true);
              setIsLoading(false);
            };

            audio.onended = () => {
              console.log(`⏹️ TTS: WAV blob ended`);
              URL.revokeObjectURL(audioUrl);
              audioRef.current = null;
              resolve();
            };

            audio.onerror = (e) => {
              console.error(`❌ TTS: WAV blob error`, e);
              URL.revokeObjectURL(audioUrl);
              audioRef.current = null;
              stoppedRef.current ? resolve() : reject(new Error('Audio playback failed'));
            };

            audio.play().catch((err) => {
              if (err.name === 'NotAllowedError') {
                console.warn('⚠️ Autoplay blocked - user interaction required');
                setIsSpeaking(false);
                setIsLoading(false);
                toast({
                  title: "Tap to Enable Voice",
                  description: "Please tap anywhere on the screen to enable audio.",
                  duration: 5000,
                });
                resolve(); // Don't reject, just stop gracefully
              } else {
                stoppedRef.current ? resolve() : reject(err);
              }
            });
          });
        } else if (audioData!.audioContents && audioData!.audioContents.length > 0) {
          // Play base64 segments (Sarvam fallback format)
          for (let j = 0; j < audioData!.audioContents.length; j++) {
            const audioContent = audioData!.audioContents[j];
            
            const audioBlob = base64ToBlob(audioContent, audioData!.mimeType);
            const audioUrl = URL.createObjectURL(audioBlob);
            
            if (stoppedRef.current) {
              URL.revokeObjectURL(audioUrl);
              setIsLoading(false);
              setIsSpeaking(false);
              return;
            }

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            await new Promise<void>((resolve, reject) => {
              audio.onplay = () => {
                console.log(`▶️ TTS: Base64 segment ${j + 1}/${audioData!.audioContents!.length} playing`);
                setIsSpeaking(true);
                setIsLoading(false);
              };

              audio.onended = () => {
                console.log(`⏹️ TTS: Base64 segment ${j + 1}/${audioData!.audioContents!.length} ended`);
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
                resolve();
              };

              audio.onerror = (e) => {
                console.error(`❌ TTS: Base64 segment ${j + 1} error`, e);
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
                stoppedRef.current ? resolve() : reject(new Error('Audio playback failed'));
              };

              audio.play().catch((err) => {
                if (err.name === 'NotAllowedError') {
                  console.warn('⚠️ Autoplay blocked - user interaction required');
                  setIsSpeaking(false);
                  setIsLoading(false);
                  toast({
                    title: "Tap to Enable Voice",
                    description: "Please tap anywhere on the screen to enable audio.",
                    duration: 5000,
                  });
                  resolve(); // Don't reject, just stop gracefully
                } else {
                  stoppedRef.current ? resolve() : reject(err);
                }
              });
            });

            if (j < audioData!.audioContents.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        // Small pause between chunks for natural flow
        if (!isLastChunk) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      // All chunks complete
      setIsSpeaking(false);
      onComplete?.();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown TTS error';
      console.error("❌ TTS error:", errorMessage);
      
      // Complete silently - Sarvam only, no fallback
      console.warn('⚠️ TTS failed - completing without audio');
      setIsLoading(false);
      setIsSpeaking(false);
      setError(null);
      
      toast({
        title: "Voice Unavailable",
        description: "Voice narration failed. Continuing in reading mode.",
        variant: "default"
      });
      
      onComplete?.();
    }
  }, [stopSpeaking, toast]);

  // Play audio directly from cache - no API calls, for seamless presentation playback
  const speakFromCache = useCallback(async (
    text: string,
    languageCode: SupportedLanguage = 'en-IN',
    gender: "female" | "male" = "female",
    onComplete?: () => void,
    onProgress?: (progress: { currentTime: number; duration: number; progress: number }) => void
  ): Promise<boolean> => {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      console.log("No text to speak from cache");
      onComplete?.();
      return false;
    }

    // Stop any currently playing audio
    stopSpeaking();
    stoppedRef.current = false;

    // Check cache
    const cacheKey = getCacheKey(cleanText, languageCode, gender);
    const cached = audioCache.get(cacheKey);

    if (!cached || Date.now() - cached.timestamp >= CACHE_TTL) {
      console.warn(`⚠️ Cache miss for: "${cleanText.substring(0, 30)}..."`);
      onComplete?.();
      return false;
    }

    // Check if we have audio (either Blob or base64)
    const hasAudio = cached.audioBlob || (cached.audioContents && cached.audioContents.length > 0);
    
    if (!hasAudio) {
      console.warn(`⚠️ Cache empty for: "${cleanText.substring(0, 30)}..."`);
      onComplete?.();
      return false;
    }

    const segmentCount = cached.audioContents?.length || 0;
    console.log(`▶️ Playing from cache: "${cleanText.substring(0, 30)}..." (${segmentCount} segments)`);

    try {
      setIsSpeaking(true);

      // Play from Blob (new binary format from Indic Parler)
      if (cached.audioBlob) {
        const audioUrl = URL.createObjectURL(cached.audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onplay = () => console.log(`▶️ Playing cached blob audio`);
          audio.onloadedmetadata = () => {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.duration
              : (cached.duration || 0);
            if (duration > 0) {
              onProgress?.({ currentTime: 0, duration, progress: 0 });
            }
          };
          audio.ontimeupdate = () => {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.duration
              : (cached.duration || 0);
            if (duration > 0) {
              onProgress?.({
                currentTime: audio.currentTime,
                duration,
                progress: Math.min((audio.currentTime / duration) * 100, 100),
              });
            }
          };
          audio.onended = () => {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.duration
              : (cached.duration || 0);
            if (duration > 0) {
              onProgress?.({ currentTime: duration, duration, progress: 100 });
            }
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            resolve();
          };
          audio.onerror = (e) => {
            console.error(`❌ Blob audio error`, e);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            stoppedRef.current ? resolve() : reject(new Error('Audio playback failed'));
          };
          audio.play().catch((err) => {
            if (err.name === 'NotAllowedError') {
              console.warn('⚠️ Autoplay blocked by browser');
              reject(new Error('autoplay_blocked'));
            } else {
              stoppedRef.current ? resolve() : reject(err);
            }
          });
        });
      }
      // Play from base64 content (legacy fallback TTS)
      else if (cached.audioContents && cached.audioContents.length > 0) {
        let elapsedBeforeSegment = 0;
        const knownTotalDuration = cached.duration || 0;

        for (let j = 0; j < cached.audioContents.length; j++) {
          if (stoppedRef.current) {
            setIsSpeaking(false);
            return false;
          }

          const audioContent = cached.audioContents[j];
          const audioBlob = base64ToBlob(audioContent, cached.mimeType);
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onplay = () => console.log(`▶️ Cache segment ${j + 1}/${cached.audioContents!.length} playing`);
            audio.onloadedmetadata = () => {
              const segmentDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
              const duration = knownTotalDuration || (elapsedBeforeSegment + segmentDuration);
              if (duration > 0) {
                onProgress?.({
                  currentTime: elapsedBeforeSegment,
                  duration,
                  progress: Math.min((elapsedBeforeSegment / duration) * 100, 100),
                });
              }
            };
            audio.ontimeupdate = () => {
              const segmentDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
              const duration = knownTotalDuration || (elapsedBeforeSegment + segmentDuration);
              const currentTime = elapsedBeforeSegment + audio.currentTime;
              if (duration > 0) {
                onProgress?.({
                  currentTime,
                  duration,
                  progress: Math.min((currentTime / duration) * 100, 100),
                });
              }
            };
            audio.onended = () => {
              const segmentDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
              elapsedBeforeSegment += segmentDuration;
              const duration = knownTotalDuration || elapsedBeforeSegment;
              if (duration > 0) {
                onProgress?.({
                  currentTime: j === cached.audioContents!.length - 1 ? duration : elapsedBeforeSegment,
                  duration,
                  progress: j === cached.audioContents!.length - 1 ? 100 : Math.min((elapsedBeforeSegment / duration) * 100, 100),
                });
              }
              URL.revokeObjectURL(audioUrl);
              audioRef.current = null;
              resolve();
            };
            audio.onerror = (e) => {
              console.error(`❌ Cache segment error`, e);
              URL.revokeObjectURL(audioUrl);
              audioRef.current = null;
              stoppedRef.current ? resolve() : reject(new Error('Audio playback failed'));
            };
            audio.play().catch((err) => stoppedRef.current ? resolve() : reject(err));
          });

          if (j < cached.audioContents.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }

      setIsSpeaking(false);
      onComplete?.();
      return true;
    } catch (err) {
      console.error("❌ Cache playback error:", err);
      setIsSpeaking(false);
      onComplete?.();
      return false;
    }
  }, [stopSpeaking]);

  return {
    speak,
    speakFromCache,
    stopSpeaking,
    isSpeaking,
    precacheAudio,
    precacheAllSlides,
    isLoading,
    error,
  };
};

// Extract all cached audio data for slides (used by audio saver to upload to B2)
export const getAllCachedAudioForSlides = (
  slides: Array<{ narration?: string; content?: string }>,
  languageCode: string,
  gender: "female" | "male" = "male"
): Array<{ slideIndex: number; base64Chunks: string[] }> => {
  const results: Array<{ slideIndex: number; base64Chunks: string[] }> = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const text = slide.narration || slide.content || '';
    if (!text.trim()) {
      console.log(`[AUDIO-EXTRACT] Slide ${i}: No narration text, skipping`);
      continue;
    }

    const cleanText = cleanTextForTTSInternal(text);
    if (!cleanText) {
      console.log(`[AUDIO-EXTRACT] Slide ${i}: Empty after cleaning, skipping`);
      continue;
    }

    const cacheKey = getCacheKeyInternal(cleanText, languageCode, gender);
    const cached = audioCache.get(cacheKey);

    if (!cached) {
      console.log(`[AUDIO-EXTRACT] Slide ${i}: No cached audio found (key: ${cacheKey.substring(0, 40)}...)`);
      continue;
    }

    if (cached.audioContents && cached.audioContents.length > 0) {
      console.log(`[AUDIO-EXTRACT] Slide ${i}: Found ${cached.audioContents.length} base64 chunks`);
      results.push({ slideIndex: i, base64Chunks: cached.audioContents });
    } else if (cached.audioBlob) {
      console.log(`[AUDIO-EXTRACT] Slide ${i}: Has blob but no base64 chunks (blob TTS, cannot extract for B2 upload)`);
      // For blob-based TTS (Indic Parler), we'd need to convert blob to base64
      // For now, skip - Sarvam TTS always provides base64
    } else {
      console.log(`[AUDIO-EXTRACT] Slide ${i}: Cached entry has no audio data`);
    }
  }

  console.log(`[AUDIO-EXTRACT] Extracted audio for ${results.length}/${slides.length} slides`);
  return results;
};

// Helper function to convert base64 to blob with proper chunked decoding for large audio files
function base64ToBlob(base64: string, mimeType: string): Blob {
  // Handle large base64 strings by decoding in chunks
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  // Process in chunks to avoid memory issues with large files
  const CHUNK_SIZE = 8192;
  for (let offset = 0; offset < len; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, len);
    for (let i = offset; i < end; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  }
  
  // Use proper MIME type for WAV audio
  const actualMimeType = mimeType.includes('wav') ? 'audio/wav' : mimeType;
  return new Blob([bytes], { type: actualMimeType });
}
