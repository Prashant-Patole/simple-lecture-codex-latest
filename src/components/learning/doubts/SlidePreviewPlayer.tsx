import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, Presentation } from "lucide-react";
import type { SlidePreview } from "@/types/aiTextAnswer";

interface Props {
  preview: SlidePreview;
}

export const SlidePreviewPlayer = ({ preview }: Props) => {
  const slides = preview.presentation_slides || [];
  const audioList = preview.slide_audio_urls?.urls || [];
  const images = preview.image_urls || {};

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const total = slides.length;
  const current = slides[idx];
  const audioUrl = audioList[idx]?.audioUrl || "";
  const imgUrl =
    images[String(idx)]?.url || current?.infographicUrl || "";

  const totalDuration =
    preview.total_duration_seconds ||
    audioList.reduce((a, b) => a + (b?.duration || 0), 0);

  const elapsedBefore = useMemo(() => {
    let s = 0;
    for (let i = 0; i < idx; i++) s += audioList[i]?.duration || 0;
    return s;
  }, [idx, audioList]);

  const [curTime, setCurTime] = useState(0);
  const progressPct = totalDuration
    ? Math.min(100, ((elapsedBefore + curTime) / totalDuration) * 100)
    : 0;

  // Load new source when slide changes
  useEffect(() => {
    setCurTime(0);
    const a = audioRef.current;
    if (a && audioUrl) {
      try {
        a.src = audioUrl;
        a.load();
        if (playing) a.play().catch(() => setPlaying(false));
      } catch {}
    }
    // Fallback auto-advance if no audio for this slide
    if (!audioUrl && playing) {
      clearFallback();
      fallbackTimerRef.current = window.setTimeout(() => advance(), 6000);
    }
    return clearFallback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
      } catch {}
      clearFallback();
    };
  }, []);

  function clearFallback() {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }

  function advance() {
    setIdx((i) => (i + 1 < total ? i + 1 : i));
    if (idx + 1 >= total) setPlaying(false);
  }

  function togglePlay() {
    const a = audioRef.current;
    const next = !playing;
    setPlaying(next);
    if (audioUrl && a) {
      if (next) a.play().catch(() => setPlaying(false));
      else a.pause();
    } else {
      // No audio: use timer
      clearFallback();
      if (next) fallbackTimerRef.current = window.setTimeout(advance, 6000);
    }
  }

  function goPrev() {
    clearFallback();
    setIdx((i) => Math.max(0, i - 1));
  }
  function goNext() {
    clearFallback();
    setIdx((i) => Math.min(total - 1, i + 1));
  }

  if (!total) return null;

  return (
    <div className="mt-3 w-full max-w-[520px] sm:max-w-[560px] lg:max-w-[620px] rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <div className="flex items-center gap-1.5 min-w-0">
          <Presentation className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium">Related lecture</span>
          {typeof preview.similarity === "number" && (
            <span className="text-[10px] text-muted-foreground">
              · {Math.round(preview.similarity * 100)}% match
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {idx + 1} / {total}
        </span>
      </div>

      {preview.matched_question && (
        <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-b truncate">
          Matched: {preview.matched_question}
        </p>
      )}

      <div className="p-3 space-y-2">
        {imgUrl && (
          <div className="rounded-lg overflow-hidden bg-muted aspect-video max-h-[280px] flex items-center justify-center">
            <img
              src={imgUrl}
              alt={current?.title || `Slide ${idx + 1}`}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        )}
        {current?.title && (
          <h4 className="text-sm font-semibold">{current.title}</h4>
        )}
        {current?.bullet_points?.length ? (
          <ul className="text-xs space-y-1 list-disc pl-4">
            {current.bullet_points.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="px-3 pb-3 space-y-2">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={idx === 0}
            className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 rounded-full bg-primary text-primary-foreground hover:opacity-90"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={idx >= total - 1}
            className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => setCurTime((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => {
          if (idx + 1 < total) advance();
          else setPlaying(false);
        }}
        onPause={() => {
          /* keep state in sync only if user paused via native controls (not shown) */
        }}
      />
    </div>
  );
};
