import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrolledCoursesDetailed } from "@/hooks/useEnrolledCoursesDetailed";
import { useCourseSubjects } from "@/hooks/useCourseSubjects";
import { useAllPublishedReels, type PublishedReel } from "@/hooks/usePublishedReels";
import { ReelMedia, type ReelHandle } from "@/components/learning/ReelMedia";
import { BottomNav } from "@/components/mobile/BottomNav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Film, Loader2, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";

const ALL = "__all__";
const MOBILE_REELS_LOG_PREFIX = "[MobileReels]";

const mobileReelsLog = (event: string, data?: Record<string, unknown>) => {
  console.info(MOBILE_REELS_LOG_PREFIX, event, data ?? {});
};

function useChaptersForSubject(subjectId: string | null) {
  return useQuery({
    queryKey: ["reels-chapters-for-subject", subjectId],
    queryFn: async () => {
      if (!subjectId) return [] as { id: string; title: string }[];
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("id, title, chapter_number, sequence_order")
        .eq("subject_id", subjectId)
        .order("sequence_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((c: any) => ({ id: c.id, title: c.title }));
    },
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 10,
  });
}

export default function MobileReels() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [courseId, setCourseId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { courses } = useEnrolledCoursesDetailed();
  const { data: courseSubjects = [] } = useCourseSubjects(courseId || undefined);
  const { data: chapters = [] } = useChaptersForSubject(subjectId);

  const { data: reels = [], isLoading } = useAllPublishedReels({ courseId, subjectId, chapterId });

  const courseOptions = useMemo(
    () => courses.map((c: any) => ({ id: c.id, name: c.name })),
    [courses]
  );
  const subjectOptions = useMemo(
    () => courseSubjects.map((cs: any) => ({ id: cs.subject?.id, name: cs.subject?.name })).filter((s: any) => s.id),
    [courseSubjects]
  );

  const selectedCourse = courseOptions.find((c) => c.id === courseId);
  const selectedSubject = subjectOptions.find((s: any) => s.id === subjectId);
  const selectedChapter = chapters.find((c) => c.id === chapterId);
  const activeFilterCount = [courseId, subjectId, chapterId].filter(Boolean).length;

  // Reel feed state
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reelRefs = useRef<Array<ReelHandle | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [userPaused, setUserPaused] = useState<Set<number>>(new Set());
  const touchStartY = useRef<number | null>(null);

  const goTo = useCallback((idx: number) => {
    const el = itemRefs.current[idx];
    mobileReelsLog("go-to", { idx, hasElement: Boolean(el) });
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const syncPlayback = useCallback((idx: number, reason: string) => {
    mobileReelsLog("sync-playback", {
      idx,
      reason,
      muted,
      reels: reels.length,
      handles: reelRefs.current.filter(Boolean).length,
      userPaused: Array.from(userPaused),
    });
    reelRefs.current.forEach((h, i) => {
      if (!h) {
        mobileReelsLog("missing-handle", { idx: i, activeIdx: idx, reason });
        return;
      }
      if (i === idx) {
        h.setMuted(muted);
        if (userPaused.has(i)) {
          mobileReelsLog("active-user-paused-skip-play", { idx: i, reason });
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

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) {
      mobileReelsLog("observer-skipped-no-root", { reels: reels.length });
      return;
    }
    mobileReelsLog("observer-mounted", { reels: reels.length, muted });
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          mobileReelsLog("intersection", {
            idx,
            isIntersecting: e.isIntersecting,
            ratio: Number(e.intersectionRatio.toFixed(3)),
          });
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setActiveIndex(idx);
            syncPlayback(idx, "intersection-active");
          } else {
            mobileReelsLog("pause-non-intersecting", { idx });
            reelRefs.current[idx]?.pause();
          }
        });
      },
      { root, threshold: [0, 0.6, 1] }
    );
    itemRefs.current.forEach((el, idx) => {
      if (el) {
        obs.observe(el);
        mobileReelsLog("observing-item", { idx });
      }
    });
    return () => {
      mobileReelsLog("observer-disconnect", { reels: reels.length });
      obs.disconnect();
    };
  }, [reels.length, muted, syncPlayback]);

  useEffect(() => {
    if (!reels.length) return;
    const frame = window.requestAnimationFrame(() => syncPlayback(activeIndex, "state-sync"));
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, reels.length, syncPlayback]);

  useEffect(() => {
    mobileReelsLog("mute-state-sync", { muted });
    reelRefs.current.forEach((h) => h?.setMuted(muted));
  }, [muted]);

  useEffect(() => () => {
    reelRefs.current.forEach((h) => h?.pause());
  }, []);

  // Reset feed when filters change
  useEffect(() => {
    setActiveIndex(0);
    if (scrollerRef.current) scrollerRef.current.scrollTo({ top: 0 });
  }, [courseId, subjectId, chapterId]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(dy) < 40) return;
    const next = activeIndex + (dy > 0 ? 1 : -1);
    mobileReelsLog("touch-navigation", { activeIndex, next, dy });
    if (next >= 0 && next < reels.length) goTo(next);
  };

  const clearAll = () => {
    setCourseId(null);
    setSubjectId(null);
    setChapterId(null);
  };

  // Desktop visitors: this nav entry is mobile-only — send them to rewards.
  if (isMobile === false) {
    return <Navigate to="/my-rewards" replace />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/auth?tab=login" replace />;
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col pb-16">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-3 pb-2 bg-black/80 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-white text-base font-semibold flex-1">Reels</h1>
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 h-9 px-3 gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-xs">Filters</span>
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-primary text-white">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Filter Reels</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Course</label>
                <Select
                  value={courseId ?? ALL}
                  onValueChange={(v) => {
                    const next = v === ALL ? null : v;
                    setCourseId(next);
                    setSubjectId(null);
                    setChapterId(null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="All courses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All courses</SelectItem>
                    {courseOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                <Select
                  value={subjectId ?? ALL}
                  onValueChange={(v) => {
                    const next = v === ALL ? null : v;
                    setSubjectId(next);
                    setChapterId(null);
                  }}
                  disabled={!courseId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={courseId ? "All subjects" : "Pick a course first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All subjects</SelectItem>
                    {subjectOptions.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Chapter</label>
                <Select
                  value={chapterId ?? ALL}
                  onValueChange={(v) => setChapterId(v === ALL ? null : v)}
                  disabled={!subjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={subjectId ? "All chapters" : "Pick a subject first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All chapters</SelectItem>
                    {chapters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={clearAll}>
                Clear all
              </Button>
              <Button className="flex-1" onClick={() => setFilterOpen(false)}>
                Apply
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 pb-2 overflow-x-auto bg-black/80">
          {selectedCourse && (
            <Badge
              variant="secondary"
              className="bg-white/15 text-white border-0 hover:bg-white/20 gap-1 cursor-pointer whitespace-nowrap"
              onClick={() => { setCourseId(null); setSubjectId(null); setChapterId(null); }}
            >
              {selectedCourse.name}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {selectedSubject && (
            <Badge
              variant="secondary"
              className="bg-white/15 text-white border-0 hover:bg-white/20 gap-1 cursor-pointer whitespace-nowrap"
              onClick={() => { setSubjectId(null); setChapterId(null); }}
            >
              {selectedSubject.name}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {selectedChapter && (
            <Badge
              variant="secondary"
              className="bg-white/15 text-white border-0 hover:bg-white/20 gap-1 cursor-pointer whitespace-nowrap"
              onClick={() => setChapterId(null)}
            >
              {selectedChapter.title}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}

      {/* Reel feed */}
      <div className="flex-1 min-h-0 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading reels…
          </div>
        ) : reels.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Film className="h-10 w-10 text-white/40 mb-3" />
            <p className="text-sm font-medium text-white">No reels match these filters</p>
            <p className="text-xs text-white/60 mt-1 mb-4">
              {activeFilterCount > 0
                ? "Try removing a filter to see more."
                : "Published reels will appear here."}
            </p>
            {activeFilterCount > 0 && (
              <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div
            ref={scrollerRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="h-full w-full overflow-y-scroll snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain"
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
                      mobileReelsLog("click-missing-handle", { idx: i });
                      return;
                    }
                    setUserPaused((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) {
                        mobileReelsLog("manual-resume", { idx: i });
                        next.delete(i);
                        h.play();
                      }
                      else {
                        mobileReelsLog("manual-pause", { idx: i });
                        next.add(i);
                        h.pause();
                      }
                      return next;
                    });
                  }}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
                <div className="absolute top-2 left-3 right-12 text-white/90 text-sm font-medium truncate">
                  {r.title || `Reel ${r.reel_index}`}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1.5 right-2 text-white hover:bg-white/10 h-9 w-9"
                  onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
