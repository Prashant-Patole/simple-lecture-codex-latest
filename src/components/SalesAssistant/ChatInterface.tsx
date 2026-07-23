import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ConversationState } from "@/hooks/useSalesAssistant";
import { useVoiceActivityDetection } from "@/hooks/useVoiceActivityDetection";

const languageNames: Record<string, { name: string; flag: string }> = {
  'en-IN': { name: 'English', flag: '🇮🇳' },
  'hi-IN': { name: 'हिंदी', flag: '🇮🇳' },
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  conversationState: ConversationState;
  onSendMessage: (content: string) => void;
  onStateChange: (state: ConversationState) => void;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  startListening: (language?: string) => void;
  stopListening: () => void;
  speak: (text: string, language?: string, gender?: "female" | "male", onComplete?: () => void) => void;
  counselorGender: "female" | "male";
  stopSpeaking: () => void;
  clearTranscript: () => void;
  isSupported: boolean;
  detectedLanguage: string;
  isVoiceMode?: boolean;
}

export const ChatInterface = ({ 
  messages, 
  isLoading, 
  conversationState,
  onSendMessage,
  onStateChange,
  isListening,
  isSpeaking,
  transcript,
  startListening,
  stopListening,
  speak,
  stopSpeaking,
  clearTranscript,
  isSupported,
  detectedLanguage,
  counselorGender,
  isVoiceMode = false,
}: ChatInterfaceProps) => {
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showVoiceHelp, setShowVoiceHelp] = useState(true);
  const [vadLevel, setVadLevel] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string>("");
  const sentTranscriptRef = useRef<string>("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track first interaction to enable audio
  const handleFirstInteraction = useCallback(() => {
    if (!hasInteracted) {
      console.log("🖱️ First interaction detected in ChatInterface");
      setHasInteracted(true);
      
      // If there's a pending message to speak, speak it now
      const lastMessage = messages[messages.length - 1];
      if (autoSpeak && lastMessage?.role === "assistant" && lastMessage.content) {
        console.log("🔊 Speaking pending message after interaction");
        speak(lastMessage.content, detectedLanguage, counselorGender);
      }
    }
  }, [hasInteracted, messages, autoSpeak, speak, detectedLanguage, counselorGender]);

  // Immediate interrupt handler - cancel speech synthesis immediately
  const handleInterrupt = useCallback(() => {
    console.log("🛑 Interrupt triggered - immediately stopping speech");

    // CRITICAL: Cancel speech synthesis immediately
    window.speechSynthesis.cancel();
    
    // Then call our stoppers
    stopSpeaking();
    stopListening();
    clearTranscript();
    sentTranscriptRef.current = "";

    // Delay before starting listening to prevent recognition errors
    setTimeout(() => {
      console.log("Starting listening after interrupt");
      startListening(detectedLanguage);
    }, 400);
  }, [stopSpeaking, stopListening, clearTranscript, startListening, detectedLanguage]);

  // Debounce VAD interrupts - reduced cooldown for faster response
  const lastInterruptRef = useRef<number>(0);
  
  const debouncedInterrupt = useCallback(() => {
    const now = Date.now();
    if (now - lastInterruptRef.current < 300) {
      return; // Reduced from 1000ms to 300ms
    }
    lastInterruptRef.current = now;
    
    console.log("🎤 VAD: User started speaking, triggering interrupt");
    handleInterrupt();
  }, [handleInterrupt]);

  // Voice Activity Detection with audio level feedback - better speech filtering
  const { isDetecting, currentLevel } = useVoiceActivityDetection({
    enabled: isSpeaking,
    onVoiceDetected: debouncedInterrupt,
    onAudioLevel: setVadLevel,
    threshold: 55, // Increased to reduce false positives
    detectionDuration: 400, // Increased for sustained detection
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Update conversation state based on listening/speaking
  // SKIP when voice mode is active - ConversationMode handles this
  useEffect(() => {
    if (isVoiceMode) return;
    
    if (isListening) {
      onStateChange("listening");
    } else if (isSpeaking) {
      onStateChange("speaking");
    } else if (isLoading) {
      onStateChange("processing");
    } else {
      onStateChange("idle");
    }
  }, [isListening, isSpeaking, isLoading, onStateChange, isVoiceMode]);

  // Auto-speak new assistant messages and start continuous listening
  // SKIP when voice mode is active - ConversationMode handles this
  useEffect(() => {
    if (isVoiceMode) return;
    
    const lastMessage = messages[messages.length - 1];
    if (
      autoSpeak &&
      lastMessage?.role === "assistant" &&
      lastMessage.content &&
      lastMessage.content !== lastMessageRef.current
    ) {
      lastMessageRef.current = lastMessage.content;
      
      // For welcome message (first message), speak immediately even without prior interaction
      const isWelcomeMessage = messages.length === 1;
      
      if (isWelcomeMessage || hasInteracted) {
        speak(lastMessage.content, detectedLanguage, counselorGender, () => {
          console.log("AI finished speaking, starting listening");
          sentTranscriptRef.current = "";
          startListening(detectedLanguage);
        });
      }
    }
  }, [messages, autoSpeak, speak, detectedLanguage, startListening, counselorGender, hasInteracted, isVoiceMode]);

  // Smart silence detection based on utterance length
  // SKIP when voice mode is active - ConversationMode handles this
  useEffect(() => {
    if (isVoiceMode) return;
    
    if (!transcript || !isListening) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    setInput(transcript);

    const trimmed = transcript.trim();
    
    // Prevent auto-send for noise
    const noiseWords = ['um', 'uh', 'hmm', 'ah', 'er', 'uh huh', 'mhm'];
    const isSingleNoiseWord = noiseWords.some(word => trimmed.toLowerCase() === word);
    
    // Lower threshold to 3 characters to catch short responses
    if (trimmed.length < 3 || isSingleNoiseWord) {
      return;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    // Smart silence detection based on utterance length and sentence endings
    const wordCount = trimmed.split(/\s+/).length;
    const endsWithPunctuation = /[.?!]$/.test(trimmed);
    
    let silenceTimeout: number;
    if (endsWithPunctuation) {
      // Sentence complete - wait a bit longer to allow continuation
      silenceTimeout = 2000;
    } else if (wordCount < 5) {
      // Very short utterance - longest wait (user might be thinking)
      silenceTimeout = 4000;
    } else if (wordCount < 15) {
      // Medium utterance
      silenceTimeout = 3000;
    } else {
      // Long utterance - shorter wait
      silenceTimeout = 2500;
    }

    silenceTimerRef.current = setTimeout(() => {
      if (transcript.trim() && transcript !== sentTranscriptRef.current) {
        console.log(`Silence detected (${silenceTimeout}ms), auto-sending:`, transcript);
        sentTranscriptRef.current = transcript;
        stopListening();
        onSendMessage(transcript.trim());
        setInput("");
        clearTranscript();
      }
    }, silenceTimeout);

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [transcript, isListening, onSendMessage, clearTranscript, stopListening, isVoiceMode]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      sentTranscriptRef.current = "";
      startListening(detectedLanguage);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={handleFirstInteraction}>
      {/* Voice Help Banner */}
      {showVoiceHelp && (
        <div className="bg-muted border-b p-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {isSupported ? (
                <span className="text-foreground">
                  🎤 Voice enabled! Click anywhere first, then use the mic button to speak.
                </span>
              ) : (
                <span className="text-destructive">
                  ⚠️ Voice not supported. Use Chrome/Edge browser for voice features.
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVoiceHelp(false)}
              className="h-4 text-xs"
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Interrupt Overlay when AI is speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center z-10 cursor-pointer" onClick={handleInterrupt}>
          <div className="text-center space-y-4">
            <Volume2 className="h-16 w-16 text-primary mx-auto animate-pulse" />
            <div>
              <p className="text-lg font-semibold">AI is speaking...</p>
              <p className="text-sm text-muted-foreground mt-2">Tap anywhere or just speak to interrupt</p>
              {/* VAD Indicator */}
              {isDetecting && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-600">Listening for your voice...</span>
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-100"
                      style={{ width: `${Math.min(100, (vadLevel / 60) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t p-4 space-y-2">
        {isSupported && (
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center gap-2 flex-wrap">
              {detectedLanguage && (
                <Badge variant="secondary" className="text-xs">
                  {languageNames[detectedLanguage]?.flag} {languageNames[detectedLanguage]?.name || detectedLanguage}
                </Badge>
              )}
              <span>
                {conversationState === "listening" 
                  ? "🎤 Listening..." 
                  : conversationState === "speaking"
                  ? "🔊 Speaking..."
                  : conversationState === "processing"
                  ? "⏳ Processing..."
                  : "Tap mic to speak"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoSpeak(!autoSpeak)}
              className="h-6"
            >
              {autoSpeak ? (
                <>
                  <Volume2 className="h-3 w-3 mr-1" />
                  Auto-speak ON
                </>
              ) : (
                <>
                  <VolumeX className="h-3 w-3 mr-1" />
                  Auto-speak OFF
                </>
              )}
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          {isSupported && (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleVoiceInput}
              disabled={isLoading}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your question or use voice..."
            className="min-h-[60px] max-h-[120px]"
            disabled={isLoading || isListening}
          />

          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
