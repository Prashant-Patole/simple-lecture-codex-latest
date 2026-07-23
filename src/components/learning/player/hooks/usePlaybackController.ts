import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Master playback clock. Wraps the AVATAR <video> element (which owns the
 * audio track) and exposes a single source of truth that beat renderers,
 * subtitles, and UI can slave off.
 *
 * Design goals:
 * 1. Never resume playback until the master (and optionally a gate promise
 *    for the current beat) is actually ready — fixes "beat plays first,
 *    avatar catches up later".
 * 2. Emit rAF ticks (not `timeupdate`) so slaves get smoother, drift-free
 *    time samples.
 * 3. Watchdog: if `currentTime` stops advancing while `state === 'playing'`,
 *    flip to `stalled`, call `.load()`, and auto-resume on `canplay`.
 * 4. Fire an explicit `seek` event on every `seeked` so slaves re-align
 *    unconditionally (fixes "scrub back → avatar moves, beat frozen").
 */

export type PlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'stalled'
  | 'ended';

type TickListener = (time: number) => void;
type SeekListener = (time: number) => void;

export interface PlaybackController {
  state: PlaybackState;
  play: (opts?: { gate?: Promise<void> }) => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  getTime: () => number;
  onTick: (fn: TickListener) => () => void;
  onSeek: (fn: SeekListener) => () => void;
}

const STALL_MS = 2000;

export function usePlaybackController(
  masterRef: React.RefObject<HTMLVideoElement | null>,
): PlaybackController {
  const [state, setState] = useState<PlaybackState>('idle');
  const stateRef = useRef<PlaybackState>('idle');
  const tickListeners = useRef<Set<TickListener>>(new Set());
  const seekListeners = useRef<Set<SeekListener>>(new Set());
  const rafRef = useRef<number | null>(null);
  const lastAdvanceRef = useRef({ time: 0, at: 0 });

  const setStateSafe = (s: PlaybackState) => {
    stateRef.current = s;
    setState(s);
    if (import.meta.env.DEV) console.log(`[Sync] state=${s}`);
  };

  const emitTick = useCallback(() => {
    const v = masterRef.current;
    if (v) tickListeners.current.forEach((fn) => fn(v.currentTime));
    rafRef.current = requestAnimationFrame(emitTick);
  }, [masterRef]);

  // rAF loop while playing
  useEffect(() => {
    if (state === 'playing') {
      rafRef.current = requestAnimationFrame(emitTick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [state, emitTick]);

  // Bind master element events
  useEffect(() => {
    const v = masterRef.current;
    if (!v) return;

    const onPlaying = () => setStateSafe('playing');
    const onPause = () => {
      if (stateRef.current !== 'ended') setStateSafe('paused');
    };
    const onWaiting = () => setStateSafe('loading');
    const onCanPlay = () => {
      if (stateRef.current === 'loading' || stateRef.current === 'stalled') {
        setStateSafe(v.paused ? 'ready' : 'playing');
      }
    };
    const onSeeking = () => setStateSafe('seeking');
    const onSeeked = () => {
      const t = v.currentTime;
      seekListeners.current.forEach((fn) => fn(t));
      setStateSafe(v.paused ? 'ready' : 'playing');
    };
    const onEnded = () => setStateSafe('ended');

    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('seeking', onSeeking);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('seeking', onSeeking);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('ended', onEnded);
    };
  }, [masterRef]);

  // Stall watchdog
  useEffect(() => {
    const id = setInterval(() => {
      const v = masterRef.current;
      if (!v || stateRef.current !== 'playing') return;
      const now = performance.now();
      if (v.currentTime !== lastAdvanceRef.current.time) {
        lastAdvanceRef.current = { time: v.currentTime, at: now };
        return;
      }
      if (now - lastAdvanceRef.current.at > STALL_MS && v.readyState < 3) {
        console.warn('[Sync] stalled — reloading master');
        setStateSafe('stalled');
        try {
          v.load();
        } catch {}
      }
    }, 1000);
    return () => clearInterval(id);
  }, [masterRef]);

  const waitCanPlay = (v: HTMLVideoElement, timeoutMs = 6000) =>
    new Promise<void>((resolve) => {
      if (v.readyState >= 3) return resolve();
      const done = () => {
        v.removeEventListener('canplay', done);
        clearTimeout(t);
        resolve();
      };
      const t = setTimeout(done, timeoutMs);
      v.addEventListener('canplay', done);
    });

  const play: PlaybackController['play'] = useCallback(
    async ({ gate } = {}) => {
      const v = masterRef.current;
      if (!v) return;
      setStateSafe('loading');
      await Promise.race([
        Promise.all([waitCanPlay(v), gate ?? Promise.resolve()]),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
      try {
        await v.play();
      } catch (e) {
        console.warn('[Sync] play() rejected', e);
        setStateSafe('paused');
      }
    },
    [masterRef],
  );

  const pause = useCallback(() => {
    masterRef.current?.pause();
  }, [masterRef]);

  const seek = useCallback(
    (time: number) => {
      const v = masterRef.current;
      if (!v) return;
      v.currentTime = time;
    },
    [masterRef],
  );

  const getTime = useCallback(() => masterRef.current?.currentTime ?? 0, [masterRef]);

  const onTick = useCallback((fn: TickListener) => {
    tickListeners.current.add(fn);
    return () => tickListeners.current.delete(fn) as unknown as void;
  }, []);

  const onSeek = useCallback((fn: SeekListener) => {
    seekListeners.current.add(fn);
    return () => seekListeners.current.delete(fn) as unknown as void;
  }, []);

  return { state, play, pause, seek, getTime, onTick, onSeek };
}
