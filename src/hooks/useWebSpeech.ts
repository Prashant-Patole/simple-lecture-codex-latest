import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "@/hooks/useGoogleTTS";

interface UseWebSpeechReturn {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  startListening: (language?: string) => void;
  stopListening: () => void;
  speak: (text: string, language?: string, gender?: "female" | "male", onComplete?: () => void) => void;
  stopSpeaking: () => void;
  clearTranscript: () => void;
  isSupported: boolean;
  voicesLoaded: boolean;
}

// Export supported languages for use in other components
export { SUPPORTED_LANGUAGES, type SupportedLanguage };

export const useWebSpeech = (): UseWebSpeechReturn => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const { toast } = useToast();

  // Check if Web Speech API is supported (for speech recognition)
  const isSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  // Speech Recognition
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef(false); // Controls if we WANT to be listening

  // Load browser voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log(`🔊 ${voices.length} browser voices loaded`);
      }
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Track user interaction to enable audio
  useEffect(() => {
    const handleInteraction = () => {
      if (!userInteracted) {
        console.log("✅ User interaction detected - audio enabled");
        setUserInteracted(true);
      }
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);
    document.addEventListener("keydown", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, [userInteracted]);

  // Initialize speech recognition - NO auto-stop, caller controls when to stop
  useEffect(() => {
    if (!isSupported) return;

    const recog = new SpeechRecognition();
    recog.continuous = true; // Keep listening for natural pauses
    recog.interimResults = true;

    recog.onstart = () => {
      console.log("🎤 Speech recognition started successfully");
      setIsListening(true);
    };

    recog.onaudiostart = () => {
      console.log("🔊 Audio capture started - mic is receiving audio");
    };

    recog.onspeechstart = () => {
      console.log("🗣️ Speech detected - user is speaking");
    };

    recog.onspeechend = () => {
      console.log("🔇 Speech ended - still listening (caller controls stop)");
      // NO auto-stop here - let the caller decide when to stop
    };

    recog.onaudioend = () => {
      console.log("🔊 Audio capture ended");
    };

    recog.onresult = (event: any) => {
      let combinedTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        combinedTranscript += event.results[i][0].transcript + ' ';
      }
      combinedTranscript = combinedTranscript.trim();
      if (combinedTranscript) {
        console.log("📝 Speech recognition transcript (lang: " + recog.lang + "):", combinedTranscript);
        setTranscript(combinedTranscript);
      }
    };

    recog.onerror = (event: any) => {
      console.log("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access to use voice input",
          variant: "destructive"
        });
      } else if (event.error === 'no-speech') {
        // Don't show toast for no-speech - just restart if we should be listening
        console.log("No speech detected, will auto-restart if needed");
      } else if (event.error === 'audio-capture') {
        toast({
          title: "Microphone Unavailable",
          description: "Your microphone may be in use by another app",
          variant: "destructive"
        });
      }
    };

    recog.onend = () => {
      console.log("🎤 Speech recognition ended");
      setIsListening(false);
      
      // CRITICAL: Auto-restart if we should still be listening
      // This handles browser randomly stopping recognition
      if (shouldBeListeningRef.current && !isSpeaking) {
        console.log("🔄 Recognition ended but shouldBeListening=true, auto-restarting...");
        setTimeout(() => {
          if (shouldBeListeningRef.current && !isSpeaking) {
            try {
              recog.start();
              console.log("🎤 Auto-restarted speech recognition");
            } catch (error: any) {
              if (!error?.message?.includes("already started")) {
                console.log("Failed to auto-restart recognition:", error);
              }
            }
          }
        }, 300);
      }
    };

    recognitionRef.current = recog;
  }, [isSupported, toast, isSpeaking]);

  const startListening = useCallback(async (language = 'en-IN') => {
    if (!recognitionRef.current) {
      console.log("Speech recognition not available");
      toast({
        title: "Not Supported",
        description: "Speech recognition is not available in this browser",
        variant: "destructive"
      });
      return;
    }

    // Mark that we WANT to be listening
    shouldBeListeningRef.current = true;

    if (isListening) {
      console.log("Already listening, skipping restart");
      return;
    }

    // CRITICAL: Don't interrupt TTS if it's actively speaking
    if (isSpeaking) {
      console.log("⏳ TTS is still speaking - will start listening after it completes naturally");
      return;
    }

    // Request microphone permission on user gesture, then RELEASE the stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // CRITICAL: Stop all tracks immediately to release the mic for SpeechRecognition
      stream.getTracks().forEach(track => track.stop());
      console.log("✅ Microphone permission granted and stream released");
    } catch (error) {
      console.error("Microphone permission denied:", error);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use voice input",
        variant: "destructive"
      });
      shouldBeListeningRef.current = false;
      return;
    }

    startRecognition(language);
  }, [isSpeaking, isListening, toast]);

  const startRecognition = useCallback((language: string) => {
    const recog = recognitionRef.current;
    if (!recog) return;
    
    if (isListening) {
      console.log("Recognition already active, skipping start");
      return;
    }
    
    // Stop any existing recognition first
    try {
      recog.stop();
    } catch {
      // Ignore errors when stopping
    }
    
    // Clear transcript and start after a small delay
    setTranscript("");
    
    const languageMap: Record<string, string> = {
      'english': 'en-IN',
      'hindi': 'hi-IN',
      'kannada': 'kn-IN',
      'tamil': 'ta-IN',
      'telugu': 'te-IN',
      'malayalam': 'ml-IN',
      'bengali': 'bn-IN',
      'marathi': 'mr-IN',
      'gujarati': 'gu-IN',
      'punjabi': 'pa-IN',
    };
    
    const langCode = languageMap[language.toLowerCase()] || language;
    recog.lang = langCode;
    
    setTimeout(() => {
      try {
        recog.start();
        console.log("🎤 Starting speech recognition with language:", langCode);
      } catch (error: any) {
        if (error?.message?.includes("already started")) {
          console.log("Recognition already started");
        } else {
          console.log("Speech recognition error:", error);
          setIsListening(false);
        }
      }
    }, 100);
  }, [isListening]);

  const stopListening = useCallback(() => {
    // Mark that we DON'T want to be listening anymore
    shouldBeListeningRef.current = false;
    
    const recog = recognitionRef.current;
    if (recog) {
      try {
        recog.stop();
      } catch {
        // Ignore errors when stopping
      }
      setIsListening(false);
    }
  }, []);

  // Use browser's native speechSynthesis for instant TTS (no network latency)
  const speak = useCallback((
    text: string, 
    language = 'en-IN', 
    gender?: "female" | "male", 
    onComplete?: () => void
  ) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API not supported');
      onComplete?.();
      return;
    }

    console.log("📢 Browser TTS: Speaking", { textLength: text.length, language });

    // Cancel any ongoing speech first
    window.speechSynthesis?.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;  // Slightly slower for clarity
    utterance.pitch = 1.0;
    
    // Map language names/codes to browser language codes
    const languageMap: Record<string, string> = {
      'english': 'en-IN',
      'hindi': 'hi-IN',
      'kannada': 'kn-IN',
      'tamil': 'ta-IN',
      'telugu': 'te-IN',
      'malayalam': 'ml-IN',
      'bengali': 'bn-IN',
      'marathi': 'mr-IN',
      'gujarati': 'gu-IN',
      'punjabi': 'pa-IN',
      'en-IN': 'en-IN',
      'hi-IN': 'hi-IN',
      'kn-IN': 'kn-IN',
      'ta-IN': 'ta-IN',
      'te-IN': 'te-IN',
      'ml-IN': 'ml-IN',
    };
    
    const langCode = languageMap[language.toLowerCase()] || language;
    utterance.lang = langCode;
    
    // Try to find matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang === langCode) ||
                          voices.find(v => v.lang.startsWith(langCode.split('-')[0])) ||
                          voices.find(v => v.lang.startsWith('en'));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
      console.log("🔊 Using voice:", matchingVoice.name, matchingVoice.lang);
    }

    utterance.onstart = () => {
      console.log('🔊 Browser TTS: Started speaking');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('⏹️ Browser TTS: Finished speaking');
      setIsSpeaking(false);
      onComplete?.();
    };

    utterance.onerror = (event) => {
      console.error('❌ Browser TTS Error:', event.error);
      setIsSpeaking(false);
      onComplete?.();
    };

    window.speechSynthesis?.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript,
    isSupported,
    voicesLoaded,
  };
};
