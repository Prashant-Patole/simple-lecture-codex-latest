import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

const REEL_LOG_PREFIX = "[ReelMedia]";

const reelLog = (event: string, data?: Record<string, unknown>) => {
  console.info(REEL_LOG_PREFIX, event, data ?? {});
};

const reelWarn = (event: string, data?: Record<string, unknown>) => {
  console.warn(REEL_LOG_PREFIX, event, data ?? {});
};

const parseVimeoMessage = (raw: unknown) => {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
};

export interface ReelHandle {
  play: () => void;
  pause: () => void;
  reset: () => void;
  setMuted: (m: boolean) => void;
  isVideo: () => boolean;
  getVideo: () => HTMLVideoElement | null;
}

interface ReelMediaProps {
  videoUrl: string;
  vimeoId?: string | null;
  muted: boolean;
  active: boolean;
  preloadAuto: boolean;
  onClick?: () => void;
}

/**
 * Unified reel renderer: native <video> for dev-server URLs, Vimeo <iframe>
 * controlled via postMessage for Vimeo IDs. Parent drives play/pause through
 * the imperative ReelHandle, so both branches behave identically when scrolled.
 */
export const ReelMedia = forwardRef<ReelHandle, ReelMediaProps>(
  ({ videoUrl, vimeoId, muted, active, preloadAuto, onClick }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const vimeoReady = useRef(false);
    const pendingCmds = useRef<any[]>([]);
    const sourceLabel = vimeoId ? `vimeo:${vimeoId}` : `video:${videoUrl}`;

    const flushVimeoQueue = (reason: string) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) {
        reelWarn("vimeo-flush-skipped-no-iframe", { source: sourceLabel, reason });
        return;
      }
      vimeoReady.current = true;
      const queue = pendingCmds.current.slice();
      pendingCmds.current = [];
      reelLog("vimeo-ready-flushing", { source: sourceLabel, reason, queued: queue.length });
      iframe.contentWindow.postMessage(JSON.stringify({ method: "setLoop", value: true }), "*");
      for (const m of queue) {
        try {
          iframe.contentWindow.postMessage(JSON.stringify(m), "*");
          reelLog("vimeo-queued-command-posted", { source: sourceLabel, reason, msg: m });
        } catch (error) {
          reelWarn("vimeo-queued-post-failed", { source: sourceLabel, reason, msg: m, error });
        }
      }
    };

    const postVimeo = (msg: any) => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) {
        reelWarn("vimeo-post-skipped-no-iframe", { source: sourceLabel, msg });
        return;
      }
      if (!vimeoReady.current) {
        reelLog("vimeo-command-queued", { source: sourceLabel, msg });
        pendingCmds.current.push(msg);
        return;
      }
      try {
        iframe.contentWindow.postMessage(JSON.stringify(msg), "*");
        reelLog("vimeo-command-posted", { source: sourceLabel, msg });
      } catch (error) {
        reelWarn("vimeo-post-failed", { source: sourceLabel, msg, error });
      }
    };

    // Listen for Vimeo player "ready" then flush queued commands.
    useEffect(() => {
      if (!vimeoId) return;
      vimeoReady.current = false;
      pendingCmds.current = [];
      reelLog("vimeo-listener-mounted", { source: sourceLabel });
      const fallbackReadyTimer = window.setTimeout(() => {
        if (!vimeoReady.current) {
          reelWarn("vimeo-ready-timeout-using-onload-fallback", { source: sourceLabel });
          flushVimeoQueue("ready-timeout");
        }
      }, 1500);
      const onMsg = (e: MessageEvent) => {
        if (!iframeRef.current) return;
        // Only handle messages from our iframe
        if (e.source !== iframeRef.current.contentWindow) return;
        const data = parseVimeoMessage(e.data);
        if (!data) {
          reelWarn("vimeo-event-parse-failed", { source: sourceLabel, rawType: typeof e.data });
          return;
        }
        reelLog("vimeo-event", { source: sourceLabel, data });
        if ((data as any)?.event === "ready") {
          window.clearTimeout(fallbackReadyTimer);
          flushVimeoQueue("ready-event");
        }
      };
      window.addEventListener("message", onMsg);
      return () => {
        window.clearTimeout(fallbackReadyTimer);
        reelLog("vimeo-listener-unmounted", { source: sourceLabel });
        window.removeEventListener("message", onMsg);
      };
    }, [vimeoId, sourceLabel]);

    useImperativeHandle(
      ref,
      (): ReelHandle => ({
        play: () => {
          if (vimeoId) {
            reelLog("play-request", { source: sourceLabel, type: "vimeo", muted });
            postVimeo({ method: "setVolume", value: muted ? 0 : 1 });
            postVimeo({ method: "play" });
          } else {
            const v = videoRef.current;
            if (v) {
              reelLog("play-request", { source: sourceLabel, type: "video", muted });
              v.muted = muted;
              v.play().catch((error) => reelWarn("video-play-failed", { source: sourceLabel, error }));
            } else {
              reelWarn("play-skipped-no-video", { source: sourceLabel });
            }
          }
        },
        pause: () => {
          if (vimeoId) {
            reelLog("pause-request", { source: sourceLabel, type: "vimeo" });
            postVimeo({ method: "pause" });
          } else {
            reelLog("pause-request", { source: sourceLabel, type: "video" });
            videoRef.current?.pause();
          }
        },
        reset: () => {
          if (vimeoId) {
            reelLog("reset-request", { source: sourceLabel, type: "vimeo" });
            postVimeo({ method: "setCurrentTime", value: 0 });
          } else {
            const v = videoRef.current;
            if (v) {
              try {
                reelLog("reset-request", { source: sourceLabel, type: "video" });
                v.currentTime = 0;
              } catch (error) {
                reelWarn("video-reset-failed", { source: sourceLabel, error });
              }
            }
          }
        },
        setMuted: (m: boolean) => {
          if (vimeoId) {
            reelLog("mute-request", { source: sourceLabel, type: "vimeo", muted: m });
            postVimeo({ method: "setVolume", value: m ? 0 : 1 });
          } else if (videoRef.current) {
            reelLog("mute-request", { source: sourceLabel, type: "video", muted: m });
            videoRef.current.muted = m;
          }
        },
        isVideo: () => !vimeoId,
        getVideo: () => videoRef.current,
      }),
      [vimeoId, muted, sourceLabel]
    );

    if (vimeoId) {
      // Stable src — do not put `active` in here, control via postMessage only.
      const params = new URLSearchParams({
        api: "1",
        player_id: `reel-${vimeoId}`,
        autoplay: "0",
        loop: "1",
        muted: muted ? "1" : "0",
        background: "0",
        controls: "0",
        playsinline: "1",
        title: "0",
        byline: "0",
        portrait: "0",
      });
      return (
        <iframe
          ref={iframeRef}
          src={`https://player.vimeo.com/video/${vimeoId}?${params.toString()}`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
          style={{ border: 0 }}
          onLoad={() => {
            reelLog("vimeo-iframe-load", { source: sourceLabel, active });
            window.setTimeout(() => {
              if (!vimeoReady.current) flushVimeoQueue("iframe-load");
            }, 300);
          }}
          onClick={onClick}
        />
      );
    }
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        loop
        playsInline
        muted={muted}
        preload={preloadAuto ? "auto" : "none"}
        className="h-full w-full object-contain"
        onClick={onClick}
      />
    );
  }
);
ReelMedia.displayName = "ReelMedia";
