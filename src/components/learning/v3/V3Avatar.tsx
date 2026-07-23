import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useChromaKey } from './hooks/useChromaKey';
import { getMediaSrc, getAvatarUrl } from './utils';
import type { V3Section } from './types';

export interface V3AvatarHandle {
  /** The underlying <video> element for timeupdate/ended listeners */
  video: HTMLVideoElement | null;
  /** Load and play a new section's avatar */
  loadAvatar: (section: V3Section, jobId: string, rate: number, getBlob?: (src: string) => string | null, language?: string) => void;
}

interface V3AvatarProps {
  jobId: string;
  sectionType: string;
  visible: boolean;
}

export const V3Avatar = forwardRef<V3AvatarHandle, V3AvatarProps>(
  ({ jobId, sectionType, visible }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const prevCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const { resizeCanvas, resample, resetTexture } = useChromaKey({
      videoRef,
      canvasRef,
      overlayRef,
      enabled: true,
    });

    // On video loadeddata: resize canvas + resample key color
    useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;

      const onLoaded = () => {
        console.log(`[V3Avatar] loadeddata — ${vid.videoWidth}x${vid.videoHeight} duration=${vid.duration?.toFixed(2)}s`);
        resizeCanvas();
        resample();
      };
      vid.addEventListener('loadeddata', onLoaded);
      return () => vid.removeEventListener('loadeddata', onLoaded);
    }, [resizeCanvas, resample]);

    const loadAvatar = useCallback(
      (section: V3Section, jid: string, rate: number, getBlob?: (src: string) => string | null, language?: string) => {
        console.log(`[V3Avatar] loadAvatar called — title="${section.title || ''}" jobId=${jid} rate=${rate} lang=${language || 'english'}`);
        const vid = videoRef.current;
        const canvasCur = canvasRef.current;
        const canvasPrev = prevCanvasRef.current;
        if (!vid) {
          console.warn('[V3Avatar] videoRef is null, cannot load avatar');
          return;
        }

        const avatarPath = getAvatarUrl(section, language);
        console.log('[V3Avatar] avatarPath:', avatarPath);
        if (!avatarPath) {
          console.warn('[V3Avatar] No avatar path for section');
          return;
        }

        // Crossfade: stamp current frame onto prev canvas
        if (canvasCur && canvasPrev && canvasCur.width > 0 && canvasCur.height > 0) {
          canvasPrev.width = canvasCur.width;
          canvasPrev.height = canvasCur.height;
          try {
            const ctx = canvasPrev.getContext('2d');
            if (ctx) ctx.drawImage(canvasCur, 0, 0);
          } catch (_) {}
          canvasPrev.style.transition = 'opacity 0s';
          canvasPrev.style.opacity = '1';
        }

        // Fully reset outgoing video before swap (fixes 2nd+ section stall on iOS/Android)
        try {
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
        } catch (_) {}

        // Reset chroma-key texture so the frozen last frame doesn't linger
        resetTexture();

        // Resolve source — prefer preloaded blob
        const mediaSrc = getMediaSrc(avatarPath, jid);
        const blobSrc = getBlob?.(mediaSrc);
        const finalSrc = blobSrc || mediaSrc;
        const srcType = blobSrc ? 'BLOB' : 'PROXY';
        console.log(`[V3Avatar] Setting video src [${srcType}]: ${finalSrc.slice(0, 60)}... (original: ${mediaSrc.slice(-50)})`);

        // Autoplay-safe defaults: start MUTED so programmatic play() is never blocked.
        // We unmute on the first `playing` event.
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.playbackRate = rate;

        let settled = false;
        const cleanup = () => {
          vid.removeEventListener('loadedmetadata', tryPlay);
          vid.removeEventListener('canplay', tryPlay);
          vid.removeEventListener('playing', onPlaying);
          vid.removeEventListener('error', onError);
        };
        const onPlaying = () => {
          settled = true;
          console.log(`[V3Avatar] 'playing' fired [${srcType}] — unmuting`);
          // Restore audio now that playback is actually running
          try { vid.muted = false; } catch (_) {}
          cleanup();
        };
        const onError = () => {
          console.warn('[V3Avatar] <video> error:', vid.error?.code, vid.error?.message);
          cleanup();
        };
        const tryPlay = () => {
          if (settled) return;
          const p = vid.play();
          if (!p || typeof p.then !== 'function') return;
          p.catch((err) => {
            const name = err?.name || '';
            console.warn(`[V3Avatar] play() rejected: ${name} ${err?.message || ''} readyState=${vid.readyState} networkState=${vid.networkState}`);
            // AbortError typically means load interrupted play — wait for canplay to retry
          });
        };
        vid.addEventListener('loadedmetadata', tryPlay);
        vid.addEventListener('canplay', tryPlay);
        vid.addEventListener('playing', onPlaying);
        vid.addEventListener('error', onError);

        // Diagnostic: if 3s pass without 'playing', dump state
        setTimeout(() => {
          if (!settled) {
            console.warn(`[V3Avatar] STALL after 3s — readyState=${vid.readyState} networkState=${vid.networkState} err=${vid.error?.code ?? 'none'} src=${vid.currentSrc?.slice(-60)}`);
            // One last attempt in case events were missed
            tryPlay();
          }
        }, 3000);

        vid.src = finalSrc;
        vid.load();

        // Fade prev canvas out after 2 rAF ticks
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (canvasPrev) {
              canvasPrev.style.transition = 'opacity 0.45s ease';
              canvasPrev.style.opacity = '0';
            }
          });
        });
      },
      [resetTexture]
    );

    useImperativeHandle(ref, () => ({
      get video() { return videoRef.current; },
      loadAvatar,
    }), [loadAvatar]);

    return (
      <div
        ref={overlayRef}
        className="v3-av-overlay"
        data-sectype={sectionType}
        style={{ display: visible ? 'block' : 'none' }}
      >
        <video
          ref={videoRef}
          playsInline
          crossOrigin="anonymous"
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
        />
        {/* Prev canvas: frozen frame during crossfade, z-index 2 */}
        <canvas
          ref={prevCanvasRef}
          style={{
            width: '100%', height: '100%', display: 'block',
            position: 'absolute', top: 0, left: 0,
            opacity: 0, transition: 'opacity 0.45s ease',
            pointerEvents: 'none', zIndex: 2,
            background: 'transparent',
          }}
        />
        {/* Main chroma-keyed canvas, z-index 1 */}
        <canvas
          ref={canvasRef}
          style={{
            width: '100%', height: '100%', display: 'block',
            position: 'absolute', top: 0, left: 0, zIndex: 1,
            background: 'transparent',
          }}
        />
      </div>
    );
  }
);

V3Avatar.displayName = 'V3Avatar';
