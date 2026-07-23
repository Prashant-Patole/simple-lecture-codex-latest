import { useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EducationalVideoPlayer } from "@/components/learning/player/EducationalVideoPlayer";
import { getAdminMediaUrl } from "@/components/learning/player/utils/mediaResolver";
import { SUPABASE_URL } from "@/lib/supabaseUrl";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface HeroLecturePlayerProps {
  jobId: string;
  title: string;
  subtitle?: string;
  mobileFullBleed?: boolean;
  mobileExtraHeight?: number;
  /** Force the mobile-style compact player on any viewport. */
  forceCompact?: boolean;
}

const HERO_CDN_BASE = "https://server1.simplelecture.com/video";

export const HeroLecturePlayer = ({
  jobId,
  title,
  subtitle,
  mobileFullBleed = false,
  mobileExtraHeight = 0,
  forceCompact = false,
}: HeroLecturePlayerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportIsMobile = useIsMobile();
  const isMobile = viewportIsMobile || forceCompact;

  // Fetch presentation.json via cdn_proxy — origin port 5005 is unreachable
  // from Supabase edge runtime, but the CDN host is.
  const {
    data: presentationData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["hero-presentation", jobId],
    queryFn: async () => {
      const url =
        `${SUPABASE_URL}/functions/v1/video-generation-proxy?` +
        `action=cdn_proxy&job_id=${encodeURIComponent(jobId)}` +
        `&file_path=presentation.json` +
        `&cdn_base_url=${encodeURIComponent(HERO_CDN_BASE)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load lecture (${res.status})`);
      return res.json();
    },
    enabled: !!jobId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // No auto-play, no scroll/click unmute listeners. The player mounts
  // immediately (so preload caching runs), but stays paused until the
  // user explicitly taps the central play button.


  const mobileMinHeight = 270 + (mobileExtraHeight || 0);
  return (
    <div
      className={cn(
        "w-full mx-auto",
        isMobile ? (mobileFullBleed ? "max-w-full mt-0" : "max-w-full mt-8") : "max-w-5xl mt-8 lg:mt-10"
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative w-full aspect-video overflow-hidden shadow-2xl border-4 border-white/20 bg-black",
          isMobile && mobileFullBleed ? "rounded-none border-x-0" : "rounded-2xl",
          isMobile && `min-h-[${mobileMinHeight}px]`,
          forceCompact && "force-mobile-player"
        )}
        style={isMobile ? { minHeight: `${mobileMinHeight}px` } : undefined}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading lecture…</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex items-center justify-center text-white px-4">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm">Failed to load lecture</p>
              <p className="text-xs text-white/60 mt-1">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          </div>
        )}

        {presentationData?.sections?.length ? (
          <EducationalVideoPlayer
            presentationData={presentationData}
            jobId={jobId}
            getMediaUrl={getAdminMediaUrl}
            topicTitle={title}
            className="absolute inset-0 h-full w-full"
            skipPreIntro
            forceMobileLayout={forceCompact}
            hideSectionPicker
            hideFullscreenButton
            requireTapToStart
          />
        ) : null}

        {/* Title strip — pointer-events-none so it never blocks player controls. Hidden under forceCompact to avoid covering the small player. */}
        {!forceCompact && (
          <div className="pointer-events-none absolute top-0 left-0 right-0 p-4 text-left bg-gradient-to-b from-black/60 to-transparent z-10 hidden md:block">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Free Preview Lecture
              </span>
            </div>
            <h3 className="text-white text-base md:text-lg font-bold leading-tight drop-shadow-lg">
              {title}
            </h3>
            {subtitle && (
              <p className="text-white/85 text-sm mt-0.5 line-clamp-1 drop-shadow">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
