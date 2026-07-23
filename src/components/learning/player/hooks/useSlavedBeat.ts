import { useEffect, useRef } from 'react';
import type { PlaybackController } from './usePlaybackController';

export interface BeatEntry {
  start: number;
  end: number;
  type: 'video' | 'image';
  src: string;
  blobUrl?: string;
}

interface Opts {
  controller: PlaybackController;
  beatVideoRef: React.RefObject<HTMLVideoElement | null>;
  schedule: BeatEntry[];
  onBeatChange?: (index: number, entry: BeatEntry | null) => void;
}

const DRIFT_TOLERANCE = 0.25; // seconds
const DRIFT_CHECK_MS = 500;

/**
 * Slaves a beat <video> element to the master playback controller.
 * - Swaps src when the master crosses beat boundaries.
 * - Corrects drift every 500ms.
 * - Re-aligns immediately on master `seek`.
 * - Pauses/plays in lock-step with master state.
 */
export function useSlavedBeat({ controller, beatVideoRef, schedule, onBeatChange }: Opts) {
  const currentIndexRef = useRef<number>(-1);
  const lastDriftCheckRef = useRef<number>(0);

  const findBeatIndex = (t: number): number => {
    for (let i = schedule.length - 1; i >= 0; i--) {
      if (t >= schedule[i].start && t < schedule[i].end) return i;
    }
    return -1;
  };

  const applyBeat = (masterTime: number, force = false) => {
    const beatEl = beatVideoRef.current;
    if (!beatEl || schedule.length === 0) return;
    const idx = findBeatIndex(masterTime);
    const entry = idx >= 0 ? schedule[idx] : null;

    if (idx !== currentIndexRef.current || force) {
      currentIndexRef.current = idx;
      onBeatChange?.(idx, entry);
      if (entry && entry.type === 'video') {
        const src = entry.blobUrl || entry.src;
        if (beatEl.src !== src) {
          beatEl.src = src;
          try { beatEl.load(); } catch {}
        }
        const offset = Math.max(0, masterTime - entry.start);
        try { beatEl.currentTime = offset; } catch {}
        if (controller.state === 'playing') {
          beatEl.play().catch(() => {});
        }
      } else {
        try { beatEl.pause(); } catch {}
      }
    }
  };

  // Tick handler: drift correction + boundary swap
  useEffect(() => {
    const unsub = controller.onTick((t) => {
      const idx = findBeatIndex(t);
      if (idx !== currentIndexRef.current) {
        applyBeat(t);
        return;
      }
      const now = performance.now();
      if (now - lastDriftCheckRef.current < DRIFT_CHECK_MS) return;
      lastDriftCheckRef.current = now;

      const beatEl = beatVideoRef.current;
      const entry = idx >= 0 ? schedule[idx] : null;
      if (!beatEl || !entry || entry.type !== 'video') return;
      const expected = t - entry.start;
      const drift = Math.abs(beatEl.currentTime - expected);
      if (drift > DRIFT_TOLERANCE) {
        if (import.meta.env.DEV) console.log(`[Sync] drift=${drift.toFixed(3)} → re-seek beat`);
        try { beatEl.currentTime = expected; } catch {}
      }
    });
    return () => { unsub(); };
  }, [controller, schedule]);

  // Master seek → force re-align (even within same beat)
  useEffect(() => {
    const unsub = controller.onSeek((t) => applyBeat(t, true));
    return () => { unsub(); };
  }, [controller, schedule]);

  // Mirror play/pause state
  useEffect(() => {
    const beatEl = beatVideoRef.current;
    if (!beatEl) return;
    if (controller.state === 'playing') {
      beatEl.play().catch(() => {});
    } else if (controller.state === 'paused' || controller.state === 'stalled' || controller.state === 'seeking') {
      try { beatEl.pause(); } catch {}
    }
  }, [controller.state, beatVideoRef]);
}
