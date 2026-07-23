import { useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3PlayerDialog } from "@/components/learning/V3PlayerDialog";

interface HeroV3LauncherProps {
  jobId: string;
  title: string;
  subtitle?: string;
  /** Force the mobile-style compact card on any viewport. */
  forceCompact?: boolean;
  mobileExtraHeight?: number;
}

/**
 * Hero poster card that opens the fullscreen V3 player on tap.
 * Matches the geometry of the previous <HeroLecturePlayer> so hero layout is unchanged.
 */
export const HeroV3Launcher = ({
  jobId,
  title,
  subtitle,
  forceCompact = false,
  mobileExtraHeight = 0,
}: HeroV3LauncherProps) => {
  const [open, setOpen] = useState(false);

  const mobileMinHeight = 270 + (mobileExtraHeight || 0);

  return (
    <>
      <div
        className={cn(
          "w-full mx-auto",
          forceCompact ? "max-w-full mt-8" : "max-w-5xl mt-8 lg:mt-10"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group relative w-full aspect-video overflow-hidden rounded-2xl shadow-2xl border-4 border-white/20",
            "bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#21262d]",
            "focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60",
            "transition-transform duration-300 hover:scale-[1.01]"
          )}
          style={{ minHeight: `${mobileMinHeight}px` }}
          aria-label={`Play lecture: ${title}`}
        >
          {/* Ambient glow accents */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 w-72 h-72 rounded-full bg-rose-500/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.06)_1px,_transparent_1px)] bg-[size:24px_24px] opacity-40" />

          {/* Free preview chip */}
          <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-semibold text-white tracking-wide uppercase">
              Free Sample Lecture
            </span>
          </div>

          {/* Center play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "relative flex items-center justify-center w-20 h-20 rounded-full",
                "bg-white/95 shadow-2xl shadow-amber-500/30",
                "transition-transform duration-300 group-hover:scale-110"
              )}
            >
              <span className="absolute inset-0 rounded-full bg-white/40 animate-ping opacity-40" />
              <Play className="relative w-8 h-8 text-slate-900 fill-slate-900 translate-x-0.5" />
            </div>
          </div>

          {/* Bottom title strip */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 text-left bg-gradient-to-t from-black/85 via-black/40 to-transparent">
            <h3 className="text-white text-base md:text-lg font-bold leading-tight drop-shadow-lg">
              {title}
            </h3>
            {subtitle && (
              <p className="text-white/80 text-xs md:text-sm mt-1 line-clamp-1 drop-shadow">
                {subtitle}
              </p>
            )}
          </div>
        </button>
      </div>

      <V3PlayerDialog
        open={open}
        onOpenChange={setOpen}
        documentName={title}
        initialJobId={jobId}
      />
    </>
  );
};

export default HeroV3Launcher;
