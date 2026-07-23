import { useState, useEffect, useRef, useCallback } from 'react';
import { getMediaSrc, getAvatarUrl } from '../utils';
import type { V4Section } from '../types';


/**
 * Progressive Sequential Loading Strategy
 * -----------------------------------------------------------
 * - Block boot ONLY on section 0 (initialReady).
 * - While section N plays, prefetch section N+1 in the background.
 * - On a non-adjacent jump (|new - old| > 1), abort every in-flight
 *   fetch except the target, then prioritise the target section, and
 *   resume the "current + next" rolling window from there.
 * - At most 2 concurrent section fetches globally (current + next).
 */

interface CacheProgress { loaded: number; total: number; }

function collectSectionMedia(section: V4Section, jobId: string, language?: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (path: string | undefined | null) => {
    if (!path) return;
    const src = getMediaSrc(path, jobId);
    if (src && !seen.has(src)) { seen.add(src); urls.push(src); }
  };

  add(getAvatarUrl(section, language));
  section.visual_beats?.forEach((vb) => { add(vb.video_path); add(vb.image_source); });
  section.beat_video_paths?.forEach(add);
  section.manim_video_paths?.forEach(add);
  add(section.video_path);
  section.render_spec?.infographic_beats?.forEach((ib) => add(ib.image_source));

  const quizItems = [
    ...(section.questions || []),
    ...(section.understanding_quiz ? [section.understanding_quiz] : []),
  ];
  for (const q of quizItems) {
    if (q.avatar_clips) {
      add(q.avatar_clips.question);
      add(q.avatar_clips.correct);
      add(q.avatar_clips.wrong);
      add(q.avatar_clips.explanation);
    }
    if (q.explanation_visual) {
      add(q.explanation_visual.video_path);
      add(q.explanation_visual.wan_video_path);
      add(q.explanation_visual.image_path);
      add(q.explanation_visual.image_source);
    }
  }
  return urls;
}

export function useMediaPreloader(sections: V4Section[], currentIndex: number, jobId: string, language?: string) {
  const blobMapRef = useRef<Map<string, string>>(new Map());
  const preloadedSectionsRef = useRef<Set<number>>(new Set());
  // Per-section AbortController for in-flight fetches, so we can cancel selectively on jump.
  const sectionControllersRef = useRef<Map<number, AbortController>>(new Map());
  const [initialReady, setInitialReady] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress>({ loaded: 0, total: 0 });
  const mountedRef = useRef(true);
  const prevIndexRef = useRef<number>(currentIndex);

  const fetchAsBlob = useCallback(async (url: string, signal: AbortSignal, sectionIdx: number): Promise<boolean> => {
    if (blobMapRef.current.has(url)) return true;
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) return false;
      const blob = await resp.blob();
      if (signal.aborted || !mountedRef.current) return false;
      const blobUrl = URL.createObjectURL(blob);
      blobMapRef.current.set(url, blobUrl);
      return true;
    } catch {
      return false;
    }
  }, []);

  const preloadSection = useCallback(async (
    index: number,
    opts: { blockUntil: 'gate' | 'all' } = { blockUntil: 'all' }
  ): Promise<void> => {
    if (index < 0 || index >= sections.length) return;
    if (preloadedSectionsRef.current.has(index)) return;
    if (sectionControllersRef.current.has(index)) return;

    const ctrl = new AbortController();
    sectionControllersRef.current.set(index, ctrl);

    const allUrls = collectSectionMedia(sections[index], jobId, language);

    const t0 = performance.now();
    console.log(`[MediaPreloader] Section ${index} — assets=${allUrls.length}, mode=${opts.blockUntil}`);

    // Gate mode must not start any fetch. The active <video> element should own
    // the only network request so HTTP Range streaming can start immediately.
    if (opts.blockUntil === 'gate') {
      preloadedSectionsRef.current.add(index);
      sectionControllersRef.current.delete(index);
      return;
    }

    const fetches = allUrls.map((u) => fetchAsBlob(u, ctrl.signal, index));

    const allDone = Promise.allSettled(fetches).then(() => {
      if (ctrl.signal.aborted) return;
      preloadedSectionsRef.current.add(index);
      console.log(`[MediaPreloader] Section ${index} FULLY cached in ${Math.round(performance.now() - t0)}ms`);
      if (sectionControllersRef.current.get(index) === ctrl) {
        sectionControllersRef.current.delete(index);
      }
    });

    await allDone;

  }, [sections, jobId, language, fetchAsBlob]);


  // Phase 1: boot — fetch ONLY section 0 (gate), then prefetch section 1 in background.
  useEffect(() => {
    if (sections.length === 0) return;

    // Reset state for a new presentation
    blobMapRef.current.forEach((u) => URL.revokeObjectURL(u));
    blobMapRef.current.clear();
    preloadedSectionsRef.current.clear();
    sectionControllersRef.current.forEach((c) => c.abort());
    sectionControllersRef.current.clear();
    setInitialReady(false);

    setCacheProgress({ loaded: 0, total: 0 });
    setInitialReady(true);
    console.log(`[MediaPreloader] BOOT — no blob fetch before playback (lang=${language || 'english'}). Section 1 preload waits for playing.`);

    return () => {
      sectionControllersRef.current.forEach((c) => c.abort());
      sectionControllersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, language, sections]);

  // Phase 2: section jumps only abort stale background work. We intentionally do
  // not queue the next section here; V4Player calls preloadNext() on `playing`.
  useEffect(() => {
    if (!initialReady || sections.length === 0) return;

    const prev = prevIndexRef.current;
    const delta = Math.abs(currentIndex - prev);
    prevIndexRef.current = currentIndex;

    if (delta > 1) {
      console.log(`[MediaPreloader] JUMP detected ${prev} -> ${currentIndex} — aborting stale prefetches`);
      // Abort every in-flight fetch that isn't the target or target+1
      for (const [idx, ctrl] of sectionControllersRef.current.entries()) {
        if (idx !== currentIndex && idx !== currentIndex + 1) {
          ctrl.abort();
          sectionControllersRef.current.delete(idx);
        }
      }
    }

  }, [currentIndex, initialReady, sections.length]);

  // Unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sectionControllersRef.current.forEach((c) => c.abort());
      sectionControllersRef.current.clear();
      console.log(`[MediaPreloader] UNMOUNT — revoking ${blobMapRef.current.size} blob URLs`);
      blobMapRef.current.forEach((u) => URL.revokeObjectURL(u));
      blobMapRef.current.clear();
    };
  }, []);

  const getBlob = useCallback((proxySrc: string): string | null => {
    return blobMapRef.current.get(proxySrc) || null;
  }, []);

  /** Called by the player when the current section STARTS playing — kicks off next-section preload. */
  const preloadNext = useCallback((fromIndex: number) => {
    const nextIdx = fromIndex + 1;
    if (nextIdx >= sections.length) return;
    if (preloadedSectionsRef.current.has(nextIdx)) return;
    if (sectionControllersRef.current.has(nextIdx)) return;
    console.log(`[MediaPreloader] preloadNext(${fromIndex}) → starting section ${nextIdx} in background`);
    preloadSection(nextIdx, { blockUntil: 'all' });
  }, [sections.length, preloadSection]);

  return { getBlob, initialReady, cacheProgress, preloadNext };

}
