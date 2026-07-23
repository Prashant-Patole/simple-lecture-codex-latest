import { ReactNode, forwardRef, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

import { useIsMobile } from '@/hooks/use-mobile';
import './player.css';

export type StageMode = 'intro' | 'content' | 'recap' | 'memory' | 'quiz' | 'summary';

interface StageProps {
  mode: StageMode;
  children: ReactNode;
  className?: string;
}

export const Stage = forwardRef<HTMLDivElement, StageProps>(({
  mode,
  children,
  className,
}, ref) => {
  const isMobile = useIsMobile();
  return (
    <div 
      ref={ref}
      className={cn(
        "player-stage",
        `mode-${mode}`,
        
        className
      )}
    >
      
      {children}
    </div>
  );
});

Stage.displayName = 'Stage';

// Content Layer Component
interface ContentLayerProps {
  title?: string;
  children: ReactNode;
  isHidden?: boolean;
  className?: string;
}

export const ContentLayer = ({
  title,
  children,
  isHidden = false,
  className,
}: ContentLayerProps) => {
  return (
    <div 
      className={cn(
        "content-layer",
        isHidden && "opacity-0 pointer-events-none",
        className
      )}
    >
      {title && (
        <h2 className="section-title">{title}</h2>
      )}
      <div className="content-box">
        {children}
      </div>
    </div>
  );
};

// Video Layer Component
interface VideoLayerProps {
  isVisible: boolean;
  videoSrc?: string | null;
  preloadedVideoElement?: HTMLVideoElement | null;
  isFullscreen?: boolean;
  isPlaying?: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onCanPlay?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  /** Offset in seconds to seek the beat video to on load/attach (for mid-segment sync) */
  segmentStartOffset?: number;
  /** Maximum duration this video should play within the segment */
  segmentMaxDuration?: number;
  /**
   * Monotonic token — increment from the parent when you intentionally want
   * the visual beat video to seek to `segmentStartOffset`. VideoLayer writes
   * `currentTime` only when this token changes, never on ordinary renders.
   */
  beatSeekToken?: number;
}

export const VideoLayer = ({
  isVisible,
  videoSrc,
  preloadedVideoElement,
  isFullscreen = false,
  isPlaying = false,
  onEnded,
  onTimeUpdate,
  onCanPlay,
  videoRef,
  segmentStartOffset,
  segmentMaxDuration,
  beatSeekToken,
}: VideoLayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const preloadedAttachedRef = useRef<HTMLVideoElement | null>(null);
  const attachStartTimeRef = useRef<number>(0);
  const attachIdRef = useRef<number>(0);
  const boundaryLoggedAttachRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(-1);
  const stuckCountRef = useRef<number>(0);
  const shouldLoop = !!segmentMaxDuration && segmentMaxDuration > 0;
  const renderCountRef = useRef<number>(0);
  const lastSeekWriteRef = useRef<{ t: number; source: string; wallTime: number } | null>(null);
  const backwardWatchLastTRef = useRef<number>(-1);
  renderCountRef.current += 1;

  // Stable ref for the inline <video>. Must NOT be an inline arrow, otherwise
  // React invokes it with null and then the same element on every render,
  // which is what caused the repeated attach + currentTime rewrite loop.
  const inlineElRef = useRef<HTMLVideoElement | null>(null);
  const inlineVideoRef = useCallback((el: HTMLVideoElement | null) => {
    inlineElRef.current = el;
    if (videoRef && 'current' in videoRef) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    }
    if (el) {
      el.loop = shouldLoop;
      attachStartTimeRef.current = performance.now();
      attachIdRef.current += 1;
      boundaryLoggedAttachRef.current = null;
      console.log('[BEAT-STRICT][ATTACH]', {
        attachId: attachIdRef.current,
        renderCount: renderCountRef.current,
        preloaded: false,
        readyState: el.readyState,
        looping: shouldLoop,
      });
      // NOTE: We deliberately do NOT write el.currentTime here anymore.
      // Initial + mid-segment seeks are performed in the beatSeekToken effect
      // below so seeks happen only on intentional token changes, not on
      // every re-render.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoop, videoRef]);

  // [BEAT-STRICT] render-props snapshot on every render
  console.log('[BEAT-STRICT][RENDER_PROPS]', {
    isVisible,
    isPlaying,
    renderCount: renderCountRef.current,
    videoSrc: videoSrc ? videoSrc.slice(0, 80) : null,
    segmentStartOffset,
    segmentMaxDuration,
    beatSeekToken,
    hasPreloaded: !!preloadedVideoElement,
  });

  // Token-driven seek: writes currentTime ONLY when videoSrc changes or the
  // parent explicitly bumps beatSeekToken (user scrub, reattach, etc.).
  useEffect(() => {
    const activeVideo = preloadedAttachedRef.current || inlineElRef.current;
    if (!activeVideo || !videoSrc) return;
    const target = Math.max(0, segmentStartOffset || 0);
    const cur = activeVideo.currentTime;
    if (Math.abs(cur - target) < 0.1) {
      console.log('[BEAT-STRICT][SEEK_SKIP]', {
        reason: 'already-close',
        cur: cur.toFixed(3),
        target: target.toFixed(3),
        beatSeekToken,
      });
      return;
    }
    console.log('[BEAT-STRICT][SEEK_WRITE]', {
      source: 'token-effect',
      from: cur.toFixed(3),
      to: target.toFixed(3),
      beatSeekToken,
      videoSrc: videoSrc.slice(0, 80),
      isPlaying,
    });
    try {
      activeVideo.currentTime = target;
      lastSeekWriteRef.current = { t: target, source: 'token-effect', wallTime: performance.now() };
    } catch (err) {
      console.warn('[BEAT-STRICT][SEEK_WRITE_THREW]', err);
    }
    if (isPlaying) {
      activeVideo.play().catch((err) => {
        console.warn('[BEAT-STRICT][SEEK_PLAY_REJECTED]', err?.name, err?.message);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatSeekToken, videoSrc]);

  // Backward-jump watcher: reports if the beat video regresses in time while
  // playing without a preceding SEEK_WRITE. This proves whether something is
  // pulling the video back on its own.
  useEffect(() => {
    if (!videoSrc) return;
    const id = window.setInterval(() => {
      const v = preloadedAttachedRef.current || inlineElRef.current;
      if (!v) return;
      const t = v.currentTime;
      const last = backwardWatchLastTRef.current;
      if (last >= 0 && t + 0.15 < last) {
        const lastWrite = lastSeekWriteRef.current;
        const wallDelta = lastWrite ? (performance.now() - lastWrite.wallTime) : Infinity;
        console.warn('[BEAT-STRICT][BACKWARD_JUMP]', {
          from: last.toFixed(3),
          to: t.toFixed(3),
          delta: (t - last).toFixed(3),
          lastWriteSource: lastWrite?.source ?? null,
          msSinceLastWrite: Number.isFinite(wallDelta) ? Math.round(wallDelta) : 'never',
          paused: v.paused,
          isPlaying,
        });
      }
      backwardWatchLastTRef.current = t;
    }, 250);
    return () => window.clearInterval(id);
  }, [videoSrc, isPlaying]);



  // When a preloaded element is provided, attach it to the DOM directly
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // If the same preloaded element is already attached, skip re-attachment
    if (preloadedVideoElement && preloadedVideoElement === preloadedAttachedRef.current && preloadedVideoElement.parentNode === container) {
      console.log('[VideoLayer] Same preloaded element already attached, skipping re-attach src=', videoSrc);
      return;
    }

    // Clean up previously attached preloaded element
    if (preloadedAttachedRef.current && preloadedAttachedRef.current.parentNode === container) {
      const prev = preloadedAttachedRef.current;
      const playedFor = (performance.now() - attachStartTimeRef.current) / 1000;
      const early = !!segmentMaxDuration && playedFor + 0.15 < segmentMaxDuration;
      console.log(
        `[VideoLayer DETACH] attachId=${attachIdRef.current} src=${prev.src} playedFor=${playedFor.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s videoCurrentTime=${prev.currentTime.toFixed(2)}s EARLY=${early}`
      );
      prev.onended = null;
      container.removeChild(prev);
      preloadedAttachedRef.current = null;
    }

    if (preloadedVideoElement && videoSrc) {
      // Style and configure the preloaded element
      preloadedVideoElement.className = 'content-video';
      preloadedVideoElement.muted = true;
      preloadedVideoElement.playsInline = true;
      // Loop when we have a desired segment duration so short Manim clips
      // keep filling the segment instead of firing native `ended`.
      preloadedVideoElement.loop = shouldLoop;
      // Suppress native end-driven cleanup when enforcing a segment boundary.
      preloadedVideoElement.onended = shouldLoop ? null : () => onEnded?.();
      preloadedVideoElement.oncanplay = () => onCanPlay?.();
      preloadedVideoElement.ontimeupdate = () => onTimeUpdate?.(preloadedVideoElement.currentTime);
      preloadedVideoElement.onloadedmetadata = () => {
        console.log(
          `[VideoLayer META] naturalDur=${preloadedVideoElement.duration.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s looping=${preloadedVideoElement.loop} src=${videoSrc}`
        );
      };
      preloadedVideoElement.onplay = () =>
        console.log(`[VideoLayer PLAY] src=${videoSrc} t=${preloadedVideoElement.currentTime.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s`);
      preloadedVideoElement.onpause = () =>
        console.log(`[VideoLayer PAUSE] src=${videoSrc} t=${preloadedVideoElement.currentTime.toFixed(2)}s`);
      preloadedVideoElement.onerror = () =>
        console.warn(`[VideoLayer ERROR] src=${videoSrc}`);

      // Initial offset seek — applied ONCE on attach. Any later mid-segment
      // sync is handled by the beatSeekToken effect below (not on renders).
      const initialOffset = segmentStartOffset && segmentStartOffset > 0.5 ? segmentStartOffset : 0;
      preloadedVideoElement.currentTime = initialOffset;
      lastSeekWriteRef.current = { t: initialOffset, source: 'attach-preloaded', wallTime: performance.now() };
      console.log('[BEAT-STRICT][SEEK_WRITE]', {
        source: 'attach-preloaded',
        offset: initialOffset.toFixed(3),
        videoSrc: (videoSrc || '').slice(0, 80),
      });

      container.appendChild(preloadedVideoElement);
      preloadedAttachedRef.current = preloadedVideoElement;
      attachStartTimeRef.current = performance.now();
      attachIdRef.current += 1;
      boundaryLoggedAttachRef.current = null;

      console.log('[BEAT-STRICT][ATTACH]', {
        attachId: attachIdRef.current,
        renderCount: renderCountRef.current,
        preloaded: true,
        offset: (segmentStartOffset || 0).toFixed(3),
        beatSeekToken,
        videoSrc: (videoSrc || '').slice(0, 80),
      });


      if (Number.isFinite(preloadedVideoElement.duration) && preloadedVideoElement.duration > 0) {
        console.log(
          `[VideoLayer META] naturalDur=${preloadedVideoElement.duration.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s looping=${preloadedVideoElement.loop} src=${videoSrc}`
        );
      }

      // Fire canplay immediately if already buffered
      if (preloadedVideoElement.readyState >= 3) {
        onCanPlay?.();
      }
    }

    return () => {
      if (preloadedAttachedRef.current && preloadedAttachedRef.current.parentNode === container) {
        const prev = preloadedAttachedRef.current;
        const playedFor = (performance.now() - attachStartTimeRef.current) / 1000;
        const early = !!segmentMaxDuration && playedFor + 0.15 < segmentMaxDuration;
        console.log(
          `[VideoLayer DETACH-cleanup] attachId=${attachIdRef.current} src=${prev.src} playedFor=${playedFor.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s EARLY=${early}`
        );
        prev.onended = null;
        container.removeChild(prev);
        preloadedAttachedRef.current = null;
      }
    };
  }, [preloadedVideoElement, videoSrc]);

  // Segment lifetime is controlled by the presentation clock in EducationalVideoPlayer.
  // This layer only logs boundary evidence; it must not clear/detach beats early.
  useEffect(() => {
    if (!segmentMaxDuration || segmentMaxDuration <= 0) return;

    const activeVideo = preloadedAttachedRef.current || videoRef?.current;
    if (!activeVideo) return;
    const attachIdAtStart = attachIdRef.current;

    const checkBoundary = () => {
      if (attachIdAtStart !== attachIdRef.current) return;
      const elapsed = (performance.now() - attachStartTimeRef.current) / 1000;
      if (elapsed >= segmentMaxDuration && boundaryLoggedAttachRef.current !== attachIdAtStart) {
        boundaryLoggedAttachRef.current = attachIdAtStart;
        console.log(
          `[VideoLayer BOUNDARY] attachId=${attachIdAtStart} elapsed=${elapsed.toFixed(2)}s >= desiredDur=${segmentMaxDuration.toFixed(2)}s, presentation-clock-controls-clear src=${activeVideo.src}`
        );
      }
    };

    activeVideo.addEventListener('timeupdate', checkBoundary);
    // Backup ticker in case timeupdate is sparse / paused
    const interval = window.setInterval(checkBoundary, 250);
    return () => {
      activeVideo.removeEventListener('timeupdate', checkBoundary);
      window.clearInterval(interval);
    };
  }, [segmentMaxDuration, videoRef, preloadedVideoElement, onEnded]);

  // Heartbeat log while a beat video is attached (every 500ms) + STUCK detection
  useEffect(() => {
    if (!videoSrc) return;
    const activeVideo = preloadedAttachedRef.current || videoRef?.current;
    if (!activeVideo) {
      console.warn('[BEAT-STRICT][TICK_NO_VIDEO] videoSrc set but no active video element yet');
      return;
    }
    lastTickTimeRef.current = -1;
    stuckCountRef.current = 0;
    if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - attachStartTimeRef.current) / 1000;
      const t = activeVideo.currentTime;
      const advanced = lastTickTimeRef.current < 0 ? true : (t - lastTickTimeRef.current) > 0.01;
      const shouldBePlaying = isVisible && isPlaying;
      const stuck = shouldBePlaying && (activeVideo.paused || !advanced) && activeVideo.readyState >= 2;
      if (stuck) {
        stuckCountRef.current += 1;
        console.warn('[BEAT-STRICT][STUCK_DETECTED]', {
          consecutive: stuckCountRef.current,
          videoT: t.toFixed(3),
          lastVideoT: lastTickTimeRef.current.toFixed(3),
          advanced,
          paused: activeVideo.paused,
          ended: activeVideo.ended,
          seeking: activeVideo.seeking,
          readyState: activeVideo.readyState,
          networkState: activeVideo.networkState,
          duration: Number.isFinite(activeVideo.duration) ? activeVideo.duration.toFixed(2) : 'NaN',
          playbackRate: activeVideo.playbackRate,
          looping: activeVideo.loop,
          isVisible,
          isPlaying,
          src: (activeVideo.src || videoSrc || '').slice(0, 80),
        });
        // Try to recover once to gather more evidence
        if (stuckCountRef.current === 2) {
          console.warn('[BEAT-STRICT][STUCK_RECOVERY_ATTEMPT] calling play()');
          activeVideo.play().then(
            () => console.log('[BEAT-STRICT][STUCK_RECOVERY_PLAY_OK]'),
            (err) => console.warn('[BEAT-STRICT][STUCK_RECOVERY_PLAY_FAIL]', err?.name, err?.message)
          );
        }
      } else {
        stuckCountRef.current = 0;
      }
      lastTickTimeRef.current = t;
      console.log(
        `[VideoLayer TICK] src=${videoSrc} videoT=${t.toFixed(2)}s elapsedSinceAttach=${elapsed.toFixed(2)}s / desired=${(segmentMaxDuration || 0).toFixed(2)}s paused=${activeVideo.paused} looping=${activeVideo.loop} visible=${isVisible} isPlaying=${isPlaying} ready=${activeVideo.readyState} seeking=${activeVideo.seeking}`
      );
    }, 500) as unknown as number;
    return () => {
      if (tickIntervalRef.current) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [videoSrc, segmentMaxDuration, isVisible, isPlaying, videoRef, preloadedVideoElement]);

  // Auto-play/pause the active video element (resume without re-seeking)
  useEffect(() => {
    const activeVideo = preloadedAttachedRef.current || videoRef?.current;
    if (!activeVideo || !videoSrc) {
      console.log('[BEAT-STRICT][AUTOPLAY_EFFECT] action=skip reason=' + (!activeVideo ? 'no-video' : 'no-src'), { videoSrc: !!videoSrc, hasVideo: !!activeVideo, isVisible, isPlaying });
      return;
    }

    if (isVisible && isPlaying) {
      console.log('[BEAT-STRICT][AUTOPLAY_EFFECT] action=play', {
        videoT: activeVideo.currentTime.toFixed(2),
        paused: activeVideo.paused,
        ready: activeVideo.readyState,
      });
      activeVideo.play().then(
        () => console.log('[BEAT-STRICT][AUTOPLAY_PLAY_OK] t=' + activeVideo.currentTime.toFixed(2)),
        (err) => console.warn('[BEAT-STRICT][AUTOPLAY_PLAY_REJECTED]', err?.name, err?.message)
      );
    } else {
      const reason = !isVisible ? 'hidden' : 'not-playing';
      console.log('[BEAT-STRICT][AUTOPLAY_EFFECT] action=pause reason=' + reason, {
        isVisible,
        isPlaying,
        wasPaused: activeVideo.paused,
        videoT: activeVideo.currentTime.toFixed(2),
      });
      activeVideo.pause();
    }
  }, [isVisible, isPlaying, videoSrc, videoRef, preloadedVideoElement]);


  return (
    <div ref={containerRef} className={cn(
      "video-layer", 
      isVisible && "visible",
      isFullscreen && "fullscreen"
    )}>
      {/* Only create a new video element if no preloaded element was provided */}
      {videoSrc && !preloadedVideoElement && (
        <video
          ref={inlineVideoRef}
          className="content-video"
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          loop={shouldLoop}
          onEnded={shouldLoop ? undefined : onEnded}
          onCanPlay={onCanPlay}
          onLoadedMetadata={(e) => {
            const v = e.target as HTMLVideoElement;
            console.log(
              `[VideoLayer META] naturalDur=${v.duration.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s looping=${v.loop} src=${videoSrc}`
            );
          }}
          onPlay={(e) =>
            console.log(`[VideoLayer PLAY] src=${videoSrc} t=${(e.target as HTMLVideoElement).currentTime.toFixed(2)}s desiredDur=${(segmentMaxDuration || 0).toFixed(2)}s`)
          }
          onPause={(e) =>
            console.log(`[VideoLayer PAUSE] src=${videoSrc} t=${(e.target as HTMLVideoElement).currentTime.toFixed(2)}s`)
          }
          onError={(e) => {
            const v = e.target as HTMLVideoElement;
            console.warn('[BEAT-STRICT][ERROR]', { code: v.error?.code, msg: v.error?.message, src: videoSrc });
          }}
          onSeeking={(e) => {
            const v = e.target as HTMLVideoElement;
            console.log('[BEAT-STRICT][SEEKING]', { t: v.currentTime.toFixed(2), ready: v.readyState });
          }}
          onSeeked={(e) => {
            const v = e.target as HTMLVideoElement;
            console.log('[BEAT-STRICT][SEEKED]', { t: v.currentTime.toFixed(2), paused: v.paused, ready: v.readyState });
          }}
          onWaiting={(e) => {
            const v = e.target as HTMLVideoElement;
            console.warn('[BEAT-STRICT][WAITING]', { t: v.currentTime.toFixed(2), ready: v.readyState, net: v.networkState });
          }}
          onPlaying={(e) => {
            const v = e.target as HTMLVideoElement;
            console.log('[BEAT-STRICT][PLAYING]', { t: v.currentTime.toFixed(2), rate: v.playbackRate });
          }}
          onStalled={() => console.warn('[BEAT-STRICT][STALLED] src=' + (videoSrc || '').slice(0, 80))}
          onSuspend={() => console.log('[BEAT-STRICT][SUSPEND]')}
          onTimeUpdate={(e) => onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)}
        />
      )}

    </div>
  );
};
