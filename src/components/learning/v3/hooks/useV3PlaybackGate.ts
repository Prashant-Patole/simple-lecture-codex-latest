import { useEffect, useRef, useState } from 'react';

/**
 * Synchronized buffering gate for the V3 Player.
 *
 * NO-OP for English playback — the gate only attaches listeners and
 * pause/resume behavior when `language !== 'english'` AND `enabled === true`.
 * This is intentional: existing English V3 behavior must remain byte-identical
 * across every chapter using V3.
 *
 * For non-English playback (e.g. Kannada), it observes the three <video>
 * layers (avatar, WAN/beat content, manim) and:
 *   - Flags `buffering=true` when any active layer is not `readyState >= 3`.
 *   - Pauses all layers together while buffering, then resumes those that were
 *     playing when buffering ends.
 *   - Debounces 120ms so brief network blips don't flash a spinner.
 */

interface GateArgs {
  avatarEl: HTMLVideoElement | null;
  wanEl: HTMLVideoElement | null;
  manimEl: HTMLVideoElement | null;
  language: string;
  enabled: boolean;
  /** Bump when the current section changes to reset gate state. */
  sectionKey: string | number;
}

const READY_ENOUGH = 3; // HAVE_FUTURE_DATA

export function useV3PlaybackGate({
  avatarEl,
  wanEl,
  manimEl,
  language,
  enabled,
  sectionKey,
}: GateArgs): { buffering: boolean } {
  const [buffering, setBuffering] = useState(false);
  const wasPlayingRef = useRef<Record<string, boolean>>({});
  const isEnglish = (language || '').toLowerCase() === 'english';
  const inactive = isEnglish || !enabled;

  useEffect(() => {
    if (inactive) {
      setBuffering(false);
      return;
    }

    const layers: Array<[string, HTMLVideoElement | null]> = [
      ['avatar', avatarEl],
      ['wan', wanEl],
      ['manim', manimEl],
    ];
    const notReady = new Set<string>();
    let timer: number | null = null;

    const isActive = (el: HTMLVideoElement) => !!(el.currentSrc || el.getAttribute('src'));

    const flush = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setBuffering(notReady.size > 0);
      }, 120);
    };

    const cleanups: Array<() => void> = [];
    for (const [name, el] of layers) {
      if (!el) continue;

      const markNotReady = () => {
        if (isActive(el) && el.readyState < READY_ENOUGH) {
          notReady.add(name);
          flush();
        }
      };
      const markReady = () => {
        notReady.delete(name);
        flush();
      };
      const onSeeked = () => {
        if (!isActive(el) || el.readyState >= READY_ENOUGH) markReady();
        else markNotReady();
      };

      el.addEventListener('waiting', markNotReady);
      el.addEventListener('stalled', markNotReady);
      el.addEventListener('seeking', markNotReady);
      el.addEventListener('canplay', markReady);
      el.addEventListener('canplaythrough', markReady);
      el.addEventListener('playing', markReady);
      el.addEventListener('seeked', onSeeked);
      cleanups.push(() => {
        el.removeEventListener('waiting', markNotReady);
        el.removeEventListener('stalled', markNotReady);
        el.removeEventListener('seeking', markNotReady);
        el.removeEventListener('canplay', markReady);
        el.removeEventListener('canplaythrough', markReady);
        el.removeEventListener('playing', markReady);
        el.removeEventListener('seeked', onSeeked);
      });

      if (isActive(el) && el.readyState < READY_ENOUGH) notReady.add(name);
    }
    flush();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      cleanups.forEach((fn) => fn());
    };
  }, [avatarEl, wanEl, manimEl, inactive, sectionKey]);

  // Pause/resume orchestration
  useEffect(() => {
    if (inactive) return;
    const els: Record<string, HTMLVideoElement | null> = {
      avatar: avatarEl,
      wan: wanEl,
      manim: manimEl,
    };
    if (buffering) {
      for (const name of Object.keys(els)) {
        const el = els[name];
        if (el && !el.paused && !el.ended) {
          wasPlayingRef.current[name] = true;
          try { el.pause(); } catch {}
        }
      }
    } else {
      for (const name of Object.keys(els)) {
        const el = els[name];
        if (el && wasPlayingRef.current[name]) {
          wasPlayingRef.current[name] = false;
          el.play().catch(() => {});
        }
      }
    }
  }, [buffering, avatarEl, wanEl, manimEl, inactive]);

  return { buffering: inactive ? false : buffering };
}
