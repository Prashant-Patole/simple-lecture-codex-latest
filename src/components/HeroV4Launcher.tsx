import { cn } from "@/lib/utils";

interface HeroV4LauncherProps {
  jobId: string;
  title: string;
  subtitle?: string;
  /** Vimeo ID (informational; kept for parity). */
  vimeoId?: string;
  /** Direct progressive MP4 URL. Preferred over the Vimeo iframe embed
   *  because the Vimeo player is domain-restricted for this account. */
  videoMp4Url?: string;
  /** Force the mobile-style compact card on any viewport. */
  forceCompact?: boolean;
  mobileExtraHeight?: number;
}

/**
 * Inline hero video. Plays the merged final MP4 directly via a native
 * <video> — no V4 player chrome, no close button, no "Free Sample Lecture"
 * badge, no section chrome.
 */
export const HeroV4Launcher = ({
  title,
  videoMp4Url,
  forceCompact = false,
  mobileExtraHeight = 0,
}: HeroV4LauncherProps) => {
  const mobileMinHeight = 270 + (mobileExtraHeight || 0);

  return (
    <div
      className={cn(
        "w-full mx-auto",
        forceCompact ? "max-w-full mt-8" : "max-w-5xl mt-8 lg:mt-10"
      )}
    >
      <div
        className={cn(
          "relative w-full aspect-video overflow-hidden rounded-2xl shadow-2xl border-4 border-white/20 bg-black"
        )}
        style={{ minHeight: `${mobileMinHeight}px` }}
      >
        {videoMp4Url && (
          <video
            src={videoMp4Url}
            title={title}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="absolute inset-0 w-full h-full bg-black object-contain"
          />
        )}
      </div>
    </div>
  );
};

export default HeroV4Launcher;
