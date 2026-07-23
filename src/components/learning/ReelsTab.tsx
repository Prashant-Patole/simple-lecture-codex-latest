import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Film, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublishedReels, type PublishedReel } from "@/hooks/usePublishedReels";
import { ReelMedia, type ReelHandle } from "@/components/learning/ReelMedia";

const REELS_TAB_LOG_PREFIX = "[ReelsTab]";

const reelsTabLog = (event: string, data?: Record<string, unknown>) => {
  console.info(REELS_TAB_LOG_PREFIX, event, data ?? {});
};

interface Props {
  topicId?: string | null;
  chapterId?: string | null;
}

export function ReelsTab({ topicId, chapterId }: Props) {
  const { data: reels = [], isLoading } = usePublishedReels({ topicId, chapterId });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reelRefs = useRef<Array<ReelHandle | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [userPaused, setUserPaused] = useState<Set<number>>(new Set());
  const wheelLock = useRef(false);
  const touchStartY = useRef<number | null>(null);

  const goTo = useCallback((idx: number) => {
    const el = itemRefs.current[idx];
    reelsTabLog("go-to", { idx, hasElement: Boolean(el) });
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const syncPlayback = useCallback((idx: number, reason: string) => {
    reelsTabLog("sync-playback", {
      idx,
      reason,
      muted,
      reels: reels.length,
      handles: reelRefs.current.filter(Boolean).length,
      userPaused: Array.from(userPaused),
    });
    reelRefs.current.forEach((h, i) => {
      if (!h) {
        reelsTabLog("missing-handle", { idx: i, activeIdx: idx, reason });
        return;
      }
      if (i === idx) {
        h.setMuted(muted);
        if (userPaused.has(i)) {
          reelsTabLog("active-user-paused-skip-play", { idx: i, reason });
          h.pause();
          return;
        }
        h.play();
      } else {
        h.pause();
        h.reset();
      }
    });
  }, [muted, reels.length, userPaused]);

  // Track which reel is centered, play it, pause others
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) {
      reelsTabLog("observer-skipped-no-root", { reels: reels.length });
      return;
    }
    reelsTabLog("observer-mounted", { reels: reels.length, muted });
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          reelsTabLog("intersection", {
            idx,
            isIntersecting: e.isIntersecting,
            ratio: Number(e.intersectionRatio.toFixed(3)),
          });
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setActiveIndex(idx);
            syncPlayback(idx, "intersection-active");
          } else {
            reelsTabLog("pause-non-intersecting", { idx });
            reelRefs.current[idx]?.pause();
          }
        });
      },
      { root, threshold: [0, 0.6, 1] }
    );
    itemRefs.current.forEach((el, idx) => {
      if (el) {
        obs.observe(el);
        reelsTabLog("observing-item", { idx });
      }
    });
    return () => {
      reelsTabLog("observer-disconnect", { reels: reels.length });
      obs.disconnect();
    };
  }, [reels.length, muted, syncPlayback]);

  useEffect(() => {
    if (!reels.length) return;
    const frame = window.requestAnimationFrame(() => syncPlayback(activeIndex, "state-sync"));
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, reels.length, syncPlayback]);

  // Keep mute state synced
  useEffect(() => {
    reelsTabLog("mute-state-sync", { muted });
    reelRefs.current.forEach((h) => h?.setMuted(muted));
  }, [muted]);

  // Pause all when unmount
  useEffect(() => () => {
    reelRefs.current.forEach((h) => h?.pause());
  }, []);

  // Wheel: one tick = one reel
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (wheelLock.current) {
      e.preventDefault();
      return;
    }
    if (Math.abs(e.deltaY) < 8) return;
    e.preventDefault();
    wheelLock.current = true;
    const next = activeIndex + (e.deltaY > 0 ? 1 : -1);
    reelsTabLog("wheel-navigation", { activeIndex, next, deltaY: e.deltaY });
    if (next >= 0 && next < reels.length) goTo(next);
    setTimeout(() => { wheelLock.current = false; }, 450);
  }, [activeIndex, reels.length, goTo]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        if (activeIndex < reels.length - 1) goTo(activeIndex + 1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        if (activeIndex > 0) goTo(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, reels.length, goTo]);

  // Touch flick fallback
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(dy) < 40) return;
    const next = activeIndex + (dy > 0 ? 1 : -1);
    reelsTabLog("touch-navigation", { activeIndex, next, dy });
    if (next >= 0 && next < reels.length) goTo(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading reels…
      </div>
    );
  }

  if (!reels.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Film className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No reels yet</p>
        <p className="text-xs text-muted-foreground mt-1">Published reels for this topic will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center w-full">
      <div
        className="relative w-full max-w-[420px] h-[85vh] rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-900 to-black shadow-2xl shadow-black/50 ring-1 ring-white/10"
      >
        <div
          ref={scrollerRef}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain"
          tabIndex={0}
        >
          {reels.map((r: PublishedReel, i) => (
            <div
              key={r.id}
              data-idx={i}
              ref={(el) => (itemRefs.current[i] = el)}
              className="relative h-full w-full snap-start snap-always bg-black"
            >
              <ReelMedia
                ref={(el) => (reelRefs.current[i] = el)}
                videoUrl={r.video_url}
                vimeoId={r.vimeo_id}
                muted={muted}
                active={i === activeIndex}
                preloadAuto={Math.abs(i - activeIndex) <= 1}
                onClick={() => {
                  const h = reelRefs.current[i];
                  if (!h) {
                    reelsTabLog("click-missing-handle", { idx: i });
                    return;
                  }
                  setUserPaused((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) {
                      reelsTabLog("manual-resume", { idx: i });
                      next.delete(i);
                      h.play();
                    }
                    else {
                      reelsTabLog("manual-pause", { idx: i });
                      next.add(i);
                      h.pause();
                    }
                    return next;
                  });
                }}
              />
              {/* Top gradient + title */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
              <div className="absolute top-3 left-3 right-12 text-white/90 text-sm font-medium truncate">
                {r.title || `Reel ${r.reel_index}`}
              </div>
              {/* Mute */}
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 text-white hover:bg-white/10 h-9 w-9"
                onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
