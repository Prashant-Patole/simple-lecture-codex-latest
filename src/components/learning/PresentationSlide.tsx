import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, BookOpen, Lightbulb, Image as ImageIcon, Loader2, Sparkles, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { convertMathpixToStandard } from './player/utils/latexNormalizer';
import { useIsMobile } from '@/hooks/use-mobile';

interface PresentationSlideProps {
  slide: {
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
    audioUrl?: string;
  };
  isActive?: boolean;
  slideNumber?: number;
  totalSlides?: number;
  isStorySlide?: boolean;
  currentSubtitle?: string;
  isNarrating?: boolean;
  infographicPhase?: 'hidden' | 'zooming' | 'zoomed' | 'returning';
  onReplaySlide?: () => void;
  isFullScreen?: boolean;
  onVideoWaiting?: () => void;
  onVideoResumed?: () => void;
  onVideoProgress?: (state: { duration: number; currentTime: number; ended: boolean; playing: boolean }) => void;
  onVideoEnded?: () => void;
  videoSeekRequest?: { time: number; nonce: number } | null;
  assumeMediaReady?: boolean;
  playbackSpeed?: number;
}

const hasMathDelimiter = (text: string) => /(?:\$[^$]+\$|\\\(|\\\[)/.test(text);

const normalizeInlineMath = (text: string) => {
  let normalized = convertMathpixToStandard(text || "");
  normalized = normalized.replace(/(?<!\$)(\\(?:frac|sqrt|left|right|pi|times|div|cdot|leq|geq|neq|angle|triangle|degree)[^\s,.;:]*)/g, "$$$1$$");
  normalized = normalized.replace(/(?<!\$)\b([A-Za-z0-9]+(?:\/[A-Za-z0-9]+)?(?:\^[0-9A-Za-z{}]+)+)\b(?!\$)/g, "$$$1$$");
  normalized = normalized.replace(/(?<!\$)([√π][A-Za-z0-9{}()\/]*)/g, "$$$1$$");
  return normalized;
};

const normalizeFormulaMath = (text: string) => {
  const normalized = convertMathpixToStandard(text || "").trim();
  if (!normalized || hasMathDelimiter(normalized)) return normalized;
  return `$$${normalized}$$`;
};

function MathMarkdown({
  children,
  formula = false,
}: {
  children: string;
  formula?: boolean;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {formula ? normalizeFormulaMath(children) : normalizeInlineMath(children)}
    </ReactMarkdown>
  );
}

export function PresentationSlide({ 
  slide, 
  isActive = false,
  slideNumber = 1,
  totalSlides = 1,
  isStorySlide = false,
  currentSubtitle,
  isNarrating = false,
  infographicPhase = 'hidden',
  onReplaySlide,
  isFullScreen = false,
  onVideoWaiting,
  onVideoResumed,
  onVideoProgress,
  onVideoEnded,
  videoSeekRequest,
  assumeMediaReady = false,
  playbackSpeed = 1,
}: PresentationSlideProps) {
  const [videoLoading, setVideoLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setVideoLoading(Boolean(slide.videoUrl) && !assumeMediaReady);
    setImageLoaded(assumeMediaReady || !slide.infographicUrl || Boolean(slide.videoUrl));
  }, [slide.videoUrl, slide.infographicUrl, slideNumber, assumeMediaReady]);

  // Video-master / Audio-slave sync engine.
  // When a slide has BOTH a Manim video and narration audio, we treat the
  // visible <video> as the master timeline and slave the hidden <audio> to it
  // via its media events. Drift is corrected every 2s.
  useEffect(() => {
    const vid = videoRef.current;
    const aud = audioRef.current;
    if (!vid || !aud || !slide.videoUrl || !slide.audioUrl) return;

    let driftTimer: ReturnType<typeof setInterval> | null = null;
    const stopDrift = () => { if (driftTimer) { clearInterval(driftTimer); driftTimer = null; } };
    const startDrift = () => {
      stopDrift();
      driftTimer = setInterval(() => {
        if (!vid.paused && Math.abs(aud.currentTime - vid.currentTime) > 0.35) {
          try { aud.currentTime = vid.currentTime; } catch {}
        }
      }, 2000);
    };

    const onPlay = () => {
      try { aud.currentTime = vid.currentTime; } catch {}
      aud.play().catch(() => {});
      startDrift();
    };
    const onPause = () => { try { aud.pause(); } catch {} stopDrift(); };
    const onSeeked = () => { try { aud.currentTime = vid.currentTime; } catch {} };
    const onRate = () => { try { aud.playbackRate = vid.playbackRate; } catch {} };
    const onEnded = () => { try { aud.pause(); aud.currentTime = 0; } catch {} stopDrift(); };
    const onWaiting = () => { try { aud.pause(); } catch {} };
    const onPlaying = () => {
      try { aud.currentTime = vid.currentTime; } catch {}
      aud.play().catch(() => {});
    };

    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('seeked', onSeeked);
    vid.addEventListener('ratechange', onRate);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('playing', onPlaying);
    try { aud.load(); } catch {}

    return () => {
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('seeked', onSeeked);
      vid.removeEventListener('ratechange', onRate);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('playing', onPlaying);
      stopDrift();
      try { aud.pause(); } catch {}
    };
  }, [slide.videoUrl, slide.audioUrl]);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    try {
      if (v) v.playbackRate = playbackSpeed;
      if (a) a.playbackRate = playbackSpeed;
    } catch {}
  }, [playbackSpeed, slide.videoUrl, slide.audioUrl]);

  // Play/pause video (drives audio via sync engine) with narration state
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !slide.videoUrl) return;
    if (isNarrating) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isNarrating, slide.videoUrl]);

  // Reset video to start when slide changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try { v.currentTime = 0; } catch {}
  }, [slide.videoUrl, slideNumber]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSeekRequest) return;
    const targetTime = Math.max(0, videoSeekRequest.time);
    try { v.currentTime = targetTime; } catch {}
    try {
      if (audioRef.current) audioRef.current.currentTime = targetTime;
    } catch {}
    if (isNarrating) v.play().catch(() => {});
  }, [videoSeekRequest, isNarrating]);

  const reportVideoProgress = (playing: boolean, ended = false) => {
    const v = videoRef.current;
    if (!v) return;
    onVideoProgress?.({
      duration: Number.isFinite(v.duration) ? v.duration : 0,
      currentTime: Number.isFinite(v.currentTime) ? v.currentTime : 0,
      ended: ended || v.ended,
      playing,
    });
  };

  const showZoomedInfographic = slide.infographicUrl && (infographicPhase === 'zooming' || infographicPhase === 'zoomed' || infographicPhase === 'returning');
  const isTipsSlide = slide.isTips;
  const isSlideMediaLoading = isActive && ((Boolean(slide.videoUrl) && videoLoading) || (Boolean(slide.infographicUrl) && !slide.videoUrl && !imageLoaded));

  return (
    <div 
      className={cn(
        "h-full w-full rounded-none md:rounded-xl overflow-hidden transition-all duration-500 relative",
        isActive && "shadow-2xl"
      )}
      style={{ backgroundColor: '#303030' }}
    >
      {/* Full-screen Infographic Zoom - Diagram + Key Points on right, NO subtitle */}
      {showZoomedInfographic && slide.infographicUrl && (
        <div className={cn(
          "absolute inset-0 z-20 bg-background/98 backdrop-blur-sm flex items-center justify-center p-6",
          infographicPhase === 'zooming' && "animate-in fade-in zoom-in-95 duration-500",
          infographicPhase === 'returning' && "animate-out fade-out zoom-out-95 duration-300"
        )}>
          {/* Main content: Infographic + Key Points side by side */}
          <div className="w-full h-full flex items-center justify-center gap-4 overflow-hidden max-h-full">
            {/* Large Infographic - Takes most of the space */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden h-full max-h-full">
              <img 
                src={slide.infographicUrl} 
                alt="Visual diagram" 
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-2xl"
              />
            </div>
            
            {/* Key Points on the RIGHT side - vertical list */}
            {slide.keyPoints && slide.keyPoints.length > 0 && (
              <div className="w-72 shrink-0 flex flex-col gap-3 h-full justify-center overflow-auto py-4">
                <p className="text-xs text-white/70 font-medium uppercase tracking-wide flex items-center gap-1 px-2">
                  <CheckCircle className="h-3 w-3" />
                  Key Points
                </p>
                {slide.keyPoints.map((point, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-start gap-2 bg-slate-800/70 backdrop-blur-md rounded-lg px-4 py-3 border border-slate-600/30 shadow-lg",
                      "animate-in fade-in slide-in-from-right-2 duration-500"
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm font-medium text-white prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_p]:inline">
                      <MathMarkdown>{point}</MathMarkdown>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Subtitle hidden during diagram zoom - audio continues */}
        </div>
      )}

      <div className="h-full flex flex-col p-4 md:p-6">
        {/* Header - Compact */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            {isTipsSlide ? (
              <div className="p-2 bg-gradient-to-r from-primary/20 to-pink-500/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
            ) : isStorySlide ? (
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Lightbulb className="h-5 w-5 text-amber-600" />
              </div>
            ) : (
              <div className="p-2 bg-primary/20 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
            )}
            <h2 className={cn(
              "font-bold text-white",
              isFullScreen ? "text-2xl" : "text-lg"
            )}>
              {slide.title}
            </h2>
          </div>
        </div>

        {/* Main Content - 2 Column on desktop, stacked 50/50 on mobile */}
        <div className={cn(
          "flex-1 flex overflow-hidden min-h-0",
          isMobile ? "flex-col" : "flex-row gap-4",
          !isMobile && (isFullScreen ? "gap-6" : "gap-4")
        )}>
          {/* Left Column - Key Pointers (40%) - hidden on mobile */}
          {!isMobile && (
          <div className="w-2/5 flex flex-col gap-3 overflow-auto">
            {/* Formula Card */}
            {slide.formula && !showZoomedInfographic && (
              <div className="bg-slate-800/70 backdrop-blur-md p-4 rounded-xl border border-slate-600/30 shadow-lg">
                <p className="text-xs text-white mb-2 font-medium uppercase tracking-wide">
                  Key Formula
                </p>
                <div className={cn("text-center text-white", isFullScreen ? "text-2xl" : "text-lg")}>
                  <MathMarkdown formula>{slide.formula}</MathMarkdown>
                </div>
              </div>
            )}

            {/* Key Points */}
            {slide.keyPoints && slide.keyPoints.length > 0 && !showZoomedInfographic && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-white/70 font-medium uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Key Points
                </p>
                {slide.keyPoints.map((point, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-start gap-2 bg-slate-800/70 backdrop-blur-md rounded-lg px-3 py-2 border border-slate-600/30 shadow-lg",
                      "animate-in fade-in slide-in-from-left-2 duration-500"
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span className={cn(
                      "font-medium text-white prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_p]:inline",
                      isFullScreen ? "text-base" : "text-sm"
                    )}>
                      <MathMarkdown>{point}</MathMarkdown>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tips footer */}
            {isTipsSlide && (
              <div className="p-3 bg-gradient-to-r from-primary/10 to-pink-500/10 rounded-lg border border-primary/20 mt-auto">
                <p className="text-xs text-primary dark:text-primary flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="font-medium">Memory tricks to help you remember!</span>
                </p>
              </div>
            )}

            {/* Story footer */}
            {isStorySlide && !isTipsSlide && (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 mt-auto">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span className="font-medium">Real-world example!</span>
                </p>
              </div>
            )}
          </div>
          )}

          {/* Right Column - Infographic + Narration (60% desktop, full on mobile) */}
          <div className={cn(
            "flex flex-col gap-3 overflow-hidden",
            isMobile ? "flex-1" : "w-3/5"
          )}>
            {/* Video for Story Slides */}
            {slide.videoUrl && (
              <div className={cn(
                "rounded-lg overflow-hidden bg-black aspect-video relative shrink-0",
                showZoomedInfographic
                  ? "absolute top-4 right-4 z-30 w-56 md:w-72 shadow-2xl border border-white/20"
                  : "w-full"
              )}>
                {videoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  src={slide.videoUrl}
                  playsInline
                  muted
                  preload="auto"
                  className="w-full h-full object-cover pointer-events-none"
                  onLoadStart={() => { setVideoLoading(true); onVideoWaiting?.(); }}
                  onWaiting={() => { setVideoLoading(true); onVideoWaiting?.(); }}
                  onStalled={() => { onVideoWaiting?.(); }}
                  onCanPlay={() => {
                    setVideoLoading(false);
                    onVideoResumed?.();
                    if (isNarrating) videoRef.current?.play().catch(() => {});
                  }}
                  onPlaying={() => { setVideoLoading(false); reportVideoProgress(true); onVideoResumed?.(); }}
                  onTimeUpdate={() => reportVideoProgress(!videoRef.current?.paused)}
                  onLoadedMetadata={() => reportVideoProgress(false)}
                  onLoadedData={() => {
                    setVideoLoading(false);
                    reportVideoProgress(false);
                    if (isNarrating) videoRef.current?.play().catch(() => {});
                  }}
                  onEnded={() => { reportVideoProgress(false, true); onVideoEnded?.(); }}
                  onError={() => { setVideoLoading(false); onVideoResumed?.(); }}
                >
                  Your browser does not support video playback.
                </video>
                {slide.audioUrl && (
                  <audio
                    ref={audioRef}
                    src={slide.audioUrl}
                    preload="auto"
                    style={{ display: 'none' }}
                  />
                )}
              </div>
            )}


            {/* Top half on mobile: Infographic only */}
            <div className={cn(
              "flex-1 min-h-0 flex flex-col overflow-hidden",
              isMobile && "flex-[1_1_50%]"
            )}>
              {/* Infographic Thumbnail */}
              {slide.infographicUrl && !slide.videoUrl && !showZoomedInfographic && (
                <div className={cn(
                  "bg-slate-800/70 backdrop-blur-md p-1.5 rounded-xl border border-slate-600/30 shadow-lg flex flex-col overflow-hidden",
                  isMobile ? "flex-1 min-h-0" : "flex-1 min-h-0"
                )}>
                  {!isMobile && (
                    <p className="text-xs text-white/70 mb-1 font-medium uppercase tracking-wide flex items-center gap-1 shrink-0">
                      <ImageIcon className="h-3 w-3" />
                      Visual Diagram
                    </p>
                  )}
                  <div className="relative rounded-lg overflow-hidden bg-muted/30 flex-1 min-h-0 flex items-center justify-center">
                    {!imageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    <img 
                      src={slide.infographicUrl} 
                      alt="Visual diagram" 
                        className={cn(
                          "max-w-full max-h-full w-auto h-auto object-contain rounded-lg transition-opacity duration-300",
                          imageLoaded ? "opacity-100" : "opacity-0"
                        )}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                    />
                  </div>
                </div>
              )}

              {/* Infographic Description (no URL - generation failed) */}
              {slide.infographic && !slide.infographicUrl && !showZoomedInfographic && (
                <div className="p-4 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-xl border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                      <ImageIcon className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-600 mb-1">Visual Diagram (Loading Failed)</p>
                      <p className="text-sm text-muted-foreground italic">
                        Image could not be generated. Ask your question again to retry.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom half on mobile: Formula + Subtitle */}
            <div className={cn(
              isMobile && "flex-[1_1_50%] min-h-0 overflow-y-auto flex flex-col gap-2"
            )}>
              {/* Formula Card - shown here on mobile, in left column on desktop */}
              {isMobile && slide.formula && !showZoomedInfographic && (
                <div className="bg-slate-800/70 backdrop-blur-md p-3 rounded-xl border border-slate-600/30 shadow-lg shrink-0">
                  <p className="text-xs text-white mb-1 font-medium uppercase tracking-wide">
                    Key Formula
                  </p>
                  <div className="text-center text-white text-base">
                    <MathMarkdown formula>{slide.formula}</MathMarkdown>
                  </div>
                </div>
              )}

              {/* Subtitle on mobile - rendered inline instead of bottom bar */}
              {isMobile && currentSubtitle && !showZoomedInfographic && (
                <div className="shrink-0">
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2">
                    <div className="text-white leading-relaxed text-center font-medium text-sm animate-in fade-in duration-200 prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_.katex]:text-primary">
                      <MathMarkdown>{currentSubtitle}</MathMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Subtitle Bar - desktop only (mobile shows inline above) */}
        {!isMobile && currentSubtitle && !showZoomedInfographic && (
          <div className="mt-4 shrink-0">
            <div className={cn(
              "bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3",
              isFullScreen && "px-6 py-4"
            )}>
              <div className={cn(
                "text-white leading-relaxed text-center font-medium animate-in fade-in duration-200 prose prose-sm prose-invert max-w-none",
                "[&_p]:m-0 [&_.katex]:text-primary",
                isFullScreen ? "text-lg" : "text-sm"
              )}>
                <MathMarkdown>{currentSubtitle}</MathMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {isSlideMediaLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#303030]/95 text-white">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading slide media...</p>
        </div>
      )}
    </div>
  );
}
