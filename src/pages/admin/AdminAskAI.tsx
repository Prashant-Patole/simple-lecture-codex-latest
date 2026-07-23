import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PresentationSlide } from "@/components/learning/PresentationSlide";
import { PlaybackControls } from "@/components/learning/PlaybackControls";
import { convertMathpixToStandard } from "@/components/learning/player/utils/latexNormalizer";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";
import { ArrowLeft, ArrowRight, BookOpen, Film, Loader2, Play, Sparkles } from "lucide-react";

const CONTENT_API_BASE = "http://116.202.230.124:8000";
const CONTENT_PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;
const SLIDE_PRELOAD_AHEAD = 3;

type SubjectSummary = {
  subject_id: string;
  name: string;
  chapter_count: number;
  questions_done: number;
  questions_total: number;
};

type ChapterSummary = {
  chapter_id: string;
  chapter_number: number;
  title: string;
  questions_total: number;
  questions_done: number;
  questions_with_manim: number;
};

type ContentQuestion = {
  cache_id: string;
  question_text: string;
  access_tier: string;
  pregen_status: string;
  slide_count: number;
  has_image: boolean;
  has_audio: boolean;
  has_manim: boolean;
};

type QuestionsResponse = {
  total: number;
  page: number;
  limit: number;
  pages: number;
  questions: ContentQuestion[];
};

type SlidePayload = {
  cache_id: string;
  question_text: string;
  access_tier: string;
  language?: string;
  slide_count: number;
  presentationSlides: any[];
  totalDurationSeconds?: number;
};

function buildContentUrl(path: string, params?: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  search.set("path", path);
  search.set("base", CONTENT_API_BASE);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  return `${CONTENT_PROXY_URL}?${search.toString()}`;
}

async function fetchContent<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const res = await fetch(buildContentUrl(path, params));
  if (!res.ok) {
    throw new Error(`Content API failed: ${res.status}`);
  }
  return res.json();
}

function normalizeSlides(payload: SlidePayload | null) {
  return (payload?.presentationSlides || []).map((slide: any) => ({
    ...slide,
    keyPoints: slide?.keyPoints || slide?.key_points || [],
    infographicUrl: slide?.infographicUrl || slide?.infographic_url || "",
    videoUrl: slide?.videoUrl || slide?.video_url || slide?.manimVideoUrl || slide?.manim_video_url || "",
    audioUrl: slide?.audioUrl || slide?.audio_url || "",
  }));
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function MathText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {convertMathpixToStandard(text || "")}
      </ReactMarkdown>
    </div>
  );
}

function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function preloadMediaElement(url: string, kind: "audio" | "video") {
  return new Promise<void>((resolve) => {
    const element = document.createElement(kind);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeAttribute("src");
      try {
        element.load();
      } catch {}
      resolve();
    };

    const timer = window.setTimeout(finish, 12000);
    element.preload = "auto";
    element.src = url;
    if (kind === "video") {
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

async function preloadSlideMedia(slide: any) {
  await Promise.all([
    slide?.infographicUrl ? preloadImage(slide.infographicUrl) : Promise.resolve(),
    slide?.audioUrl ? preloadMediaElement(slide.audioUrl, "audio") : Promise.resolve(),
    slide?.videoUrl ? preloadMediaElement(slide.videoUrl, "video") : Promise.resolve(),
  ]);
}

function AdminContentPlayer({ payload, onClose }: { payload: SlidePayload; onClose: () => void }) {
  const slides = useMemo(() => normalizeSlides(payload), [payload]);
  const [idx, setIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoSeekRequest, setVideoSeekRequest] = useState<{ time: number; nonce: number } | null>(null);
  const [readySlideIndexes, setReadySlideIndexes] = useState<Set<number>>(() => new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadingIndexesRef = useRef<Set<number>>(new Set());

  const currentSlide = slides[idx];
  const hasVideo = Boolean(currentSlide?.videoUrl);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const queueSlidePreload = (slideIndex: number) => {
    if (slideIndex < 0 || slideIndex >= slides.length) return;
    if (readySlideIndexes.has(slideIndex) || preloadingIndexesRef.current.has(slideIndex)) return;

    preloadingIndexesRef.current.add(slideIndex);
    preloadSlideMedia(slides[slideIndex])
      .then(() => {
        setReadySlideIndexes((prev) => {
          const next = new Set(prev);
          next.add(slideIndex);
          return next;
        });
      })
      .finally(() => {
        preloadingIndexesRef.current.delete(slideIndex);
      });
  };

  const goToSlide = (next: number, shouldAutoplay = false) => {
    const bounded = Math.max(0, Math.min(slides.length - 1, next));
    setIdx(bounded);
    setCurrentTime(0);
    setDuration(0);
    setVideoSeekRequest(null);
    setIsPaused(!shouldAutoplay);
    try {
      audioRef.current?.pause();
    } catch {}
  };

  const playAudio = async () => {
    const audio = audioRef.current;
    if (!audio || hasVideo || !currentSlide?.audioUrl) return;
    audio.playbackRate = playbackSpeed;
    await audio.play();
  };

  const handlePlayPause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (nextPaused) {
      try {
        audioRef.current?.pause();
      } catch {}
      return;
    }
    playAudio().catch(() => setIsPaused(true));
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const handleSeek = (pct: number) => {
    if (!duration) return;
    const time = (pct / 100) * duration;
    setCurrentTime(time);
    if (hasVideo) {
      setVideoSeekRequest({ time, nonce: Date.now() });
      return;
    }
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  useEffect(() => {
    if (isPaused || hasVideo || !currentSlide?.audioUrl) return;
    playAudio().catch(() => setIsPaused(true));
  }, [idx, isPaused, hasVideo, currentSlide?.audioUrl, playbackSpeed]);

  useEffect(() => {
    for (let i = idx; i <= idx + SLIDE_PRELOAD_AHEAD; i++) {
      queueSlidePreload(i);
    }
  }, [idx, slides]);

  if (!currentSlide) return null;

  return (
    <div className="relative h-[78vh] overflow-hidden rounded-xl bg-[#303030]">
      <PresentationSlide
        slide={currentSlide}
        isActive
        slideNumber={idx + 1}
        totalSlides={slides.length}
        isStorySlide={currentSlide.isStory}
        isNarrating={!isPaused}
        isFullScreen={false}
        onReplaySlide={() => goToSlide(idx, true)}
        onVideoProgress={(state) => {
          setCurrentTime(state.currentTime);
          setDuration(state.duration);
        }}
        onVideoEnded={() => {
          if (idx + 1 < slides.length) goToSlide(idx + 1, true);
          else setIsPaused(true);
        }}
        videoSeekRequest={videoSeekRequest}
        assumeMediaReady={readySlideIndexes.has(idx)}
        playbackSpeed={playbackSpeed}
      />

      {!hasVideo && currentSlide.audioUrl && (
        <audio
          ref={audioRef}
          src={currentSlide.audioUrl}
          preload="auto"
          onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
          onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime || 0)}
          onEnded={() => {
            if (idx + 1 < slides.length) goToSlide(idx + 1, true);
            else setIsPaused(true);
          }}
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 z-30">
        <PlaybackControls
          isPaused={isPaused}
          onPlayPause={handlePlayPause}
          onPrevSlide={() => goToSlide(idx - 1, !isPaused)}
          onNextSlide={() => goToSlide(idx + 1, !isPaused)}
          currentSlide={idx}
          totalSlides={slides.length}
          isFullScreen={false}
          onFullScreenToggle={() => {}}
          isMinimized={false}
          onMinimizeToggle={() => {}}
          playbackSpeed={playbackSpeed}
          onSpeedChange={handleSpeedChange}
          progress={progress}
          onSeek={handleSeek}
          currentTime={formatTime(currentTime)}
          totalTime={formatTime(duration || payload.totalDurationSeconds || 0)}
          onExitPresentation={onClose}
          isSpeaking={!isPaused}
          lockedMobile={false}
        />
      </div>
    </div>
  );
}

export default function AdminAskAI() {
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [questionPage, setQuestionPage] = useState(1);
  const [payload, setPayload] = useState<SlidePayload | null>(null);
  const [watchingCacheId, setWatchingCacheId] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "questions">("select");

  const subjects = useQuery({
    queryKey: ["admin-content-subjects"],
    queryFn: () => fetchContent<SubjectSummary[]>("/content/subjects"),
  });

  const chapters = useQuery({
    queryKey: ["admin-content-chapters", subjectId],
    enabled: Boolean(subjectId),
    queryFn: () => fetchContent<ChapterSummary[]>(`/content/subjects/${subjectId}/chapters`),
  });

  const questions = useQuery({
    queryKey: ["admin-content-questions", chapterId, questionPage],
    enabled: Boolean(chapterId) && step === "questions",
    queryFn: () =>
      fetchContent<QuestionsResponse>(`/content/chapters/${chapterId}/questions`, {
        page: questionPage,
        limit: 100,
        status: "done",
      }),
  });

  const selectedSubject = subjects.data?.find((subject) => subject.subject_id === subjectId);
  const selectedChapter = chapters.data?.find((chapter) => chapter.chapter_id === chapterId);

  const handleWatch = async (cacheId: string) => {
    setWatchingCacheId(cacheId);
    try {
      const data = await fetchContent<SlidePayload>(`/content/questions/${cacheId}/slides`);
      setPayload(data);
    } finally {
      setWatchingCacheId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Ask AI Content Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse fully generated AI questions and watch their presentation slides.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-background p-1 text-sm">
          <span className={`rounded-full px-3 py-1 ${step === "select" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            1. Subject & Chapter
          </span>
          <span className={`rounded-full px-3 py-1 ${step === "questions" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            2. Topic & Questions
          </span>
        </div>
      </div>

      {step === "select" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Subject</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[68vh] overflow-y-auto">
                {subjects.isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                {subjects.data?.map((subject) => (
                  <button
                    key={subject.subject_id}
                    type="button"
                    onClick={() => {
                      setSubjectId(subject.subject_id);
                      setChapterId("");
                      setQuestionPage(1);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted ${
                      subjectId === subject.subject_id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <p className="font-medium">{subject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {subject.questions_done}/{subject.questions_total} ready - {subject.chapter_count} chapters
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Chapter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[68vh] overflow-y-auto">
                {!subjectId && <p className="text-sm text-muted-foreground">Select a subject first.</p>}
                {chapters.isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                {chapters.data?.map((chapter) => (
                  <button
                    key={chapter.chapter_id}
                    type="button"
                    onClick={() => {
                      setChapterId(chapter.chapter_id);
                      setQuestionPage(1);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted ${
                      chapterId === chapter.chapter_id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <p className="font-medium">
                      {chapter.chapter_number}. {chapter.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {chapter.questions_done}/{chapter.questions_total} ready - {chapter.questions_with_manim} Manim
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button disabled={!subjectId || !chapterId} onClick={() => setStep("questions")}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Topic & Questions
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSubject?.name || "Selected subject"} - {selectedChapter ? `${selectedChapter.chapter_number}. ${selectedChapter.title}` : "Selected chapter"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("select")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected Topic</p>
              <p className="font-medium">
                {selectedChapter ? `${selectedChapter.chapter_number}. ${selectedChapter.title}` : "No chapter selected"}
              </p>
              <p className="text-xs text-muted-foreground">
                This API returns questions by chapter, so the selected chapter is used as the topic group here.
              </p>
            </div>

            {questions.isLoading && <Skeleton className="h-72" />}
            {questions.data && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{questions.data.total} completed questions</span>
                  <span>
                    Page {questions.data.page} / {questions.data.pages || 1}
                  </span>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {questions.data.questions.map((question) => (
                    <div key={question.cache_id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <MathText text={question.question_text} className="text-sm font-medium leading-relaxed" />
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="outline">{question.access_tier}</Badge>
                            <Badge variant="secondary">{question.slide_count} slides</Badge>
                            {question.has_image && <Badge variant="outline">Image</Badge>}
                            {question.has_audio && <Badge variant="outline">Audio</Badge>}
                            {question.has_manim && (
                              <Badge className="gap-1">
                                <Film className="h-3 w-3" />
                                Manim
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleWatch(question.cache_id)}
                          disabled={watchingCacheId === question.cache_id}
                        >
                          {watchingCacheId === question.cache_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Watch
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={questionPage <= 1}
                    onClick={() => setQuestionPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={questionPage >= (questions.data.pages || 1)}
                    onClick={() => setQuestionPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(payload)} onOpenChange={(open) => !open && setPayload(null)}>
        <DialogContent className="max-w-6xl w-[96vw] p-4">
          <DialogHeader>
            <DialogTitle asChild>
              <MathText text={payload?.question_text || "AI Presentation"} className="text-2xl font-semibold leading-tight" />
            </DialogTitle>
            <DialogDescription>
              {payload?.slide_count || payload?.presentationSlides?.length || 0} slides - {payload?.language || "default language"}
            </DialogDescription>
          </DialogHeader>
          {payload && <AdminContentPlayer payload={payload} onClose={() => setPayload(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
