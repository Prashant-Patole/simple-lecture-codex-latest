import { useState, useRef, useEffect, useCallback, Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mic, MicOff, Loader2, MessageCircleQuestion, BookOpen, Lightbulb, Sparkles } from "lucide-react";
import { useCurrentAuthUser } from "@/hooks/useCurrentAuthUser";
import { toast } from "sonner";
import "katex/dist/katex.min.css";
import { DoubtsMarkdown } from "@/components/learning/doubts/DoubtsMarkdown";
import { KeyPointsList } from "@/components/learning/doubts/KeyPointsList";
import { SourceChips } from "@/components/learning/doubts/SourceChips";
import { SuggestionChips } from "@/components/learning/doubts/SuggestionChips";
import { SlidePreviewPlayer } from "@/components/learning/doubts/SlidePreviewPlayer";
import { fetchAITextAnswer } from "@/lib/api/aiTextAnswer";
import type {
  AITextAnswerSource,
  AITextAnswerSuggestion,
  SlidePreview,
} from "@/types/aiTextAnswer";
import { voiceLock } from "@/lib/voiceLock";
import {
  DoubtThreadSidebar,
  DoubtThreadMobileTrigger,
} from "@/components/learning/doubts/DoubtThreadSidebar";
import {
  createEmptyThread,
  isPlaceholderTitle,
  loadThreads,
  saveThreads,
  type DoubtThread,
} from "@/components/learning/doubts/doubtThreadsStore";

// [DoubtsDebug] Local error boundary so a katex/markdown render crash
// does NOT wipe the whole chat tree via the global ErrorBoundary.
class DoubtsErrorBoundary extends Component<{ children: ReactNode; label?: string }, { hasError: boolean; err?: any }> {
  state = { hasError: false, err: undefined as any };
  static getDerivedStateFromError(err: any) {
    return { hasError: true, err };
  }
  componentDidCatch(err: any, info: any) {
    console.error("[DoubtsTab][ErrorBoundary]", this.props.label, err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <p className="text-xs text-muted-foreground italic">
          (failed to render this message — see console)
        </p>
      );
    }
    return this.props.children;
  }
}


interface Message {
  role: "user" | "assistant";
  content: string;
  keyPoints?: string[];
  sources?: AITextAnswerSource[];
  slidePreview?: SlidePreview | null;
  suggestions?: AITextAnswerSuggestion[];
  isDocGrounded?: boolean;
  noContent?: boolean;
  examTip?: string;
  realLifeExample?: string;
}

const trimForTitle = (s: string) => {
  const t = (s || "").trim().replace(/\s+/g, " ");
  return t.length > 60 ? t.slice(0, 57) + "..." : t || "New doubt";
};

interface DoubtsTabProps {
  subjectId: string | null;
  subjectName?: string;
  previewMode?: boolean;
  previewLimit?: number;
  previewCourseId?: string;
  onPreviewQuotaExceeded?: () => void;
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

const isSupported = !!SpeechRecognitionAPI;

export const DoubtsTab = ({
  subjectId,
  subjectName,
  previewMode,
  previewLimit = 0,
  previewCourseId,
  onPreviewQuotaExceeded,
}: DoubtsTabProps) => {
  const previewKey = previewCourseId
    ? `preview-doubts-asks-${previewCourseId}`
    : null;
  const [previewUsed, setPreviewUsed] = useState<number>(() => {
    if (typeof window === "undefined" || !previewKey) return 0;
    return parseInt(localStorage.getItem(previewKey) || "0", 10) || 0;
  });
  const [threads, setThreads] = useState<DoubtThread[]>(() => loadThreads(subjectId));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => loadThreads(subjectId)[0]?.id ?? null
  );
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const messages: Message[] = (activeThread?.messages ?? []) as Message[];
  const setMessages = (updater: (prev: Message[]) => Message[]) => {
    setThreads((prev) => {
      let list = prev;
      let currentId = activeThreadId;
      let current = list.find((t) => t.id === currentId);
      if (!current) {
        current = createEmptyThread();
        currentId = current.id;
        list = [current, ...list];
        // Defer to avoid setState-in-render warning
        queueMicrotask(() => setActiveThreadId(currentId));
      }
      return list.map((t) => {
        if (t.id !== currentId) return t;
        const nextMessages = updater(t.messages as Message[]);
        const firstUser = nextMessages.find((m) => m.role === "user");
        const nextTitle =
          isPlaceholderTitle(t.title) && firstUser ? trimForTitle(firstUser.content) : t.title;
        return {
          ...t,
          title: nextTitle,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      });
    });
  };
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const hydratedSubjectRef = useRef<string | null>(subjectId);
  const { data: user } = useCurrentAuthUser();

  // [DoubtsDebug] Render + lifecycle logs
  useEffect(() => {
    console.log("[DoubtsTab] MOUNT", { subjectId });
    return () => console.log("[DoubtsTab] UNMOUNT");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-hydrate threads when subject changes
  useEffect(() => {
    if (hydratedSubjectRef.current === subjectId) return;
    hydratedSubjectRef.current = subjectId;
    const restored = loadThreads(subjectId);
    setThreads(restored);
    setActiveThreadId(restored[0]?.id ?? null);
  }, [subjectId]);

  // Persist threads
  useEffect(() => {
    if (!subjectId) return;
    saveThreads(subjectId, threads);
  }, [threads, subjectId]);

  const handleNewThread = useCallback(() => {
    const t = createEmptyThread();
    setThreads((prev) => [t, ...prev]);
    setActiveThreadId(t.id);
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    setActiveThreadId(id);
  }, []);

  const handleDeleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeThreadId === id) {
          setActiveThreadId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [activeThreadId]
  );





  const stopListening = useCallback(() => {
    console.log("[DoubtsTab] stopListening called");
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    recognitionRef.current = null;
    setIsListening(false);
    voiceLock.release("doubts");
  }, []);

  // Register voiceLock release callback
  useEffect(() => {
    voiceLock.onRelease("doubts", () => {
      console.log("[DoubtsTab] Voice lock released by another feature");
      try {
        recognitionRef.current?.abort();
      } catch (_) {}
      recognitionRef.current = null;
      setIsListening(false);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch (_) {}
      recognitionRef.current = null;
      voiceLock.release("doubts");
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!SpeechRecognitionAPI) return;

    // Acquire voice lock (kicks out SalesAssistant if it has it)
    voiceLock.acquire("doubts");

    // Request mic permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the stream immediately - we just needed permission
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.error("[DoubtsTab] Mic permission denied:", err);
      toast.error("Microphone permission denied");
      voiceLock.release("doubts");
      return;
    }

    // Stop any existing instance
    try {
      recognitionRef.current?.abort();
    } catch (_) {}

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      console.log("[DoubtsTab] onresult:", text);
      setInputText(text);
    };

    recognition.onerror = (event: any) => {
      console.error("[DoubtsTab] Recognition error:", event.error);
      if (event.error !== "aborted") {
        setIsListening(false);
        recognitionRef.current = null;
        voiceLock.release("doubts");
      }
    };

    recognition.onend = () => {
      console.log("[DoubtsTab] Recognition ended (no auto-restart)");
      setIsListening(false);
      recognitionRef.current = null;
      voiceLock.release("doubts");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      console.log("[DoubtsTab] Recognition started");
    } catch (err) {
      console.error("[DoubtsTab] Failed to start recognition:", err);
      voiceLock.release("doubts");
    }
  }, []);

  // Auto-scroll only when chat content changes, not on every input re-render.
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length, isLoading]);

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    console.log("[DoubtsTab][sendMessage] ENTER", {
      hasOverride: overrideText !== undefined,
      text,
      isLoading,
      subjectId,
      currentMsgCount: messages.length,
    });
    if (!text || isLoading || !subjectId) {
      console.warn("[DoubtsTab][sendMessage] EARLY RETURN", { text, isLoading, subjectId });
      return;
    }

    if (previewMode) {
      if (previewUsed >= previewLimit) {
        console.warn("[DoubtsTab][sendMessage] preview quota exceeded");
        onPreviewQuotaExceeded?.();
        return;
      }
      const next = previewUsed + 1;
      setPreviewUsed(next);
      if (previewKey) localStorage.setItem(previewKey, String(next));
    }


    if (isListening) stopListening();

    const userMessage: Message = { role: "user", content: text };
    // Strip suggestions/slidePreview from any prior assistant messages so only the latest shows them.
    setMessages((prev) => {
      const next = [
        ...prev.map((m) =>
          m.role === "assistant"
            ? { ...m, suggestions: undefined, slidePreview: undefined }
            : m,
        ),
        userMessage,
      ];
      return next;
    });
    setInputText("");
    setIsLoading(true);

    try {
      const result = await fetchAITextAnswer({
        question: text,
        subjectId,
        subjectName,
        language: "en",
      });

      if (!result.ok) {
        const fail = result as { ok: false; reason: string; message?: string };
        if (fail.reason === "no_content") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                fail.message ||
                "This question doesn't seem to be part of your course. Please try the Forum for general questions.",
              noContent: true,
            },
          ]);
          return;
        }
        throw new Error(fail.message || "Failed to get response");
      }

      const d = result.data;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: d.answer,
          keyPoints: Array.isArray(d.key_points) ? d.key_points : [],
          sources: Array.isArray(d.sources) ? d.sources : [],
          slidePreview: d.slide_preview?.found ? d.slide_preview : null,
          suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
          isDocGrounded: !!d.is_doc_grounded,
          examTip: d.exam_tip || d.quick_tip || undefined,
          realLifeExample: d.real_life_example || d.example || undefined,
        },
      ]);
    } catch (err: any) {
      console.error("[DoubtsTab][sendMessage] CATCH", err);
      toast.error(err?.message || "Failed to get response");
      setMessages((prev) => prev.slice(0, -1));
      setInputText(text);
    } finally {
      setIsLoading(false);
      console.log("[DoubtsTab][sendMessage] DONE");
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!subjectId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Please select a subject to ask doubts.
      </div>
    );
  }

  const sidebarProps = {
    threads,
    activeThreadId,
    onSelect: handleSelectThread,
    onNew: handleNewThread,
    onDelete: handleDeleteThread,
  };

  return (
    <div className="flex h-[calc(100vh-16rem)] md:h-[500px] border rounded-xl bg-card overflow-hidden">
      <DoubtThreadSidebar {...sidebarProps} />
      <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <MessageCircleQuestion className="h-5 w-5 text-primary" />
        <h3 className="font-medium text-sm flex-1 truncate">
          Ask Doubts {subjectName ? `— ${subjectName}` : ""}
        </h3>
        <DoubtThreadMobileTrigger {...sidebarProps} />
        {previewMode && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Free preview: {Math.min(previewUsed, previewLimit)} / {previewLimit}
          </span>
        )}
      </div>


      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
            <MessageCircleQuestion className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">Ask anything about your lectures</p>
            <p className="text-xs mt-1">AI will answer based on your course content</p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className="space-y-2">
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <DoubtsErrorBoundary label={`assistant#${i}`}>
                      {msg.noContent && (
                        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium">
                          Not part of your course — try the Forum
                        </div>
                      )}
                      {msg.isDocGrounded && !msg.noContent && (
                        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                          <BookOpen className="h-3 w-3" />
                          From your course
                        </div>
                      )}
                      <DoubtsMarkdown variant="assistant" content={msg.content} />
                      {msg.keyPoints && msg.keyPoints.length > 0 && (
                        <KeyPointsList items={msg.keyPoints} />
                      )}
                    </DoubtsErrorBoundary>
                  ) : (
                    <DoubtsErrorBoundary label={`user#${i}`}>
                      <DoubtsMarkdown variant="user" content={msg.content} />
                    </DoubtsErrorBoundary>
                  )}
                </div>
              </div>
              {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                <SourceChips sources={msg.sources} />
              )}
              {msg.role === "assistant" && msg.slidePreview?.found && (
                <DoubtsErrorBoundary label={`slides#${i}`}>
                  <SlidePreviewPlayer preview={msg.slidePreview} />
                </DoubtsErrorBoundary>
              )}
              {msg.role === "assistant" && (msg.examTip || msg.realLifeExample) && (
                <DoubtsErrorBoundary label={`tips#${i}`}>
                  <div className="max-w-[92%] sm:max-w-[85%] space-y-2">
                    {msg.examTip && (
                      <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm shadow-sm">
                        <div className="mb-1.5 flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold">
                          <Lightbulb className="h-4 w-4" />
                          Exam tip
                        </div>
                        <DoubtsMarkdown variant="assistant" content={msg.examTip} />
                      </div>
                    )}
                    {msg.realLifeExample && (
                      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm shadow-sm">
                        <div className="mb-1.5 flex items-center gap-2 text-primary font-semibold">
                          <Sparkles className="h-4 w-4" />
                          Real-life example
                        </div>
                        <DoubtsMarkdown variant="assistant" content={msg.realLifeExample} />
                      </div>
                    )}
                  </div>
                </DoubtsErrorBoundary>
              )}
              {msg.role === "assistant" &&
                msg.suggestions &&
                msg.suggestions.length > 0 && (
                  <SuggestionChips
                    items={msg.suggestions}
                    onAsk={(q) => sendMessage(q)}
                    disabled={isLoading}
                  />
                )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        {isSupported && (
          <Button
            size="icon"
            variant={isListening ? "destructive" : "outline"}
            onClick={toggleMic}
            className="shrink-0"
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Input
          placeholder="Type your doubt..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={() => sendMessage()}
          disabled={!inputText.trim() || isLoading}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      </div>
    </div>
  );
};
