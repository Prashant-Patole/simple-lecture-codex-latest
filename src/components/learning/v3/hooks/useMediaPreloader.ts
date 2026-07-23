import { useState, useEffect, useRef, useCallback } from 'react';
import { getMediaSrc, getAvatarUrl } from '../utils';
import type { V3Section } from '../types';

const INITIAL_BATCH_EN = 3;   // English: full 3-section blob prefetch (unchanged legacy behavior)
const INITIAL_BATCH_NONEN = 1; // Non-English: only prefetch section 0 to unblock playback fast
const LOOKAHEAD = 3;           // Rolling prefetch: current + N ahead
const FETCH_TIMEOUT_MS = 8000; // Per-asset timeout — skip on stall instead of wedging Phase 1

/** Video-ish URLs are streamed by the <video> element directly (ranged requests),
 *  NOT blob-cached. Blob-caching a 40–80 MB Kannada avatar means "download
 *  everything before first frame" which is the Ch7/T2 hang. */
function isVideoUrl(url: string): boolean {
  const u = url.split('?')[0].toLowerCase();
  return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.endsWith('.m4v');
}

interface CacheProgress {
  loaded: number;
  total: number;
}

/**
 * Collects ALL media URLs for a section (avatar, visual beats, manim, quiz clips, etc.)
 */
function collectSectionMedia(section: V3Section, jobId: string, language?: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (path: string | undefined | null) => {
    if (!path) return;
    const src = getMediaSrc(path, jobId);
    if (src && !seen.has(src)) {
      seen.add(src);
      urls.push(src);
    }
  };

  // Avatar (language-aware)
  add(getAvatarUrl(section, language));

  // Visual beats
  if (section.visual_beats) {
    for (const vb of section.visual_beats) {
      add(vb.video_path);
      add(vb.image_source);
    }
  }

  // Beat video paths
  if (section.beat_video_paths) {
    for (const p of section.beat_video_paths) add(p);
  }

  // Manim video paths
  if (section.manim_video_paths) {
    for (const p of section.manim_video_paths) add(p);
  }

  // Standalone video
  add(section.video_path);

  // Infographic beats
  if (section.render_spec?.infographic_beats) {
    for (const ib of section.render_spec.infographic_beats) {
      add(ib.image_source);
    }
  }

  // Quiz clips (understanding_quiz or questions array)
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
    // Explanation visual assets
    if (q.explanation_visual) {
      add(q.explanation_visual.video_path);
      add(q.explanation_visual.wan_video_path);
      add(q.explanation_visual.image_path);
      add(q.explanation_visual.image_source);
    }
  }

  return urls;
}

export function useMediaPreloader(sections: V3Section[], currentIndex: number, jobId: string, language?: string) {
  const blobMapRef = useRef<Map<string, string>>(new Map());
  const preloadedSectionsRef = useRef<Set<number>>(new Set());
  const [initialReady, setInitialReady] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress>({ loaded: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Fetch a single URL → blob, store in map. Skips video files for non-English
  // playback (video elements stream those directly via ranged requests).
  const fetchAsBlob = useCallback(async (url: string, signal?: AbortSignal, sectionIdx?: number): Promise<boolean> => {
    if (blobMapRef.current.has(url)) {
      console.log(`[MediaPreloader] SKIP (already cached) sec=${sectionIdx ?? '?'} url=${url}`);
      return true;
    }
    const nonEnglish = !!language && language.toLowerCase() !== 'english';
    if (nonEnglish && isVideoUrl(url)) {
      // Non-English path: let <video> stream via ranged requests. Do NOT blob-cache.
      console.log(`[MediaPreloader] SKIP-STREAM sec=${sectionIdx ?? '?'} url=${url.slice(-50)}`);
      return true;
    }
    // Per-asset timeout so one stalled request cannot wedge Phase 1.
    const timeoutCtrl = new AbortController();
    const combinedSignal = signal
      ? (AbortSignal.any ? AbortSignal.any([signal, timeoutCtrl.signal]) : timeoutCtrl.signal)
      : timeoutCtrl.signal;
    const timer = window.setTimeout(() => timeoutCtrl.abort(), FETCH_TIMEOUT_MS);
    try {
      console.log(`[MediaPreloader] FETCH sec=${sectionIdx ?? '?'} url=${url}`);
      const resp = await fetch(url, { signal: combinedSignal });
      if (!resp.ok) {
        console.warn(`[MediaPreloader] FETCH FAILED sec=${sectionIdx ?? '?'} status=${resp.status} url=${url}`);
        return false;
      }
      const blob = await resp.blob();
      if (signal?.aborted || !mountedRef.current) return false;
      const blobUrl = URL.createObjectURL(blob);
      blobMapRef.current.set(url, blobUrl);
      console.log(`[MediaPreloader] BLOB CREATED sec=${sectionIdx ?? '?'} size=${blob.size} blobUrl=${blobUrl.slice(0, 40)}... url=${url.slice(-60)}`);
      return true;
    } catch {
      console.warn(`[MediaPreloader] FETCH ERROR/TIMEOUT sec=${sectionIdx ?? '?'} url=${url}`);
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }, [language]);

  // Preload all media for a section
  const preloadSection = useCallback(async (index: number, signal?: AbortSignal): Promise<number> => {
    if (index < 0 || index >= sections.length) return 0;
    if (preloadedSectionsRef.current.has(index)) {
      console.log(`[MediaPreloader] Section ${index} already preloaded, skipping`);
      return 0;
    }
    preloadedSectionsRef.current.add(index);

    const urls = collectSectionMedia(sections[index], jobId, language);
    console.log(`[MediaPreloader] Preloading section ${index} — ${urls.length} assets — title="${sections[index].title || ''}"`);
    let fetched = 0;
    const results = await Promise.allSettled(
      urls.map((u) => fetchAsBlob(u, signal, index))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) fetched++;
    }
    console.log(`[MediaPreloader] Section ${index} done — ${fetched}/${urls.length} cached — blobMap total=${blobMapRef.current.size}`);
    return fetched;
  }, [sections, jobId, language, fetchAsBlob]);

  // Phase 1: preload first N sections on mount
  useEffect(() => {
    if (sections.length === 0) return;

    // Reset state for new presentation
    blobMapRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobMapRef.current.clear();
    preloadedSectionsRef.current.clear();
    setInitialReady(false);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const nonEnglish = !!language && language.toLowerCase() !== 'english';
    const batchCount = Math.min(nonEnglish ? INITIAL_BATCH_NONEN : INITIAL_BATCH_EN, sections.length);

    // Count total assets for progress
    let totalAssets = 0;
    for (let i = 0; i < batchCount; i++) {
      totalAssets += collectSectionMedia(sections[i], jobId, language).length;
    }
    setCacheProgress({ loaded: 0, total: totalAssets });
    console.log(`[MediaPreloader] Phase 1 START — ${batchCount} sections, ${totalAssets} total assets (lang=${language || 'english'})`);

    let loadedSoFar = 0;

    const run = async () => {
      for (let i = 0; i < batchCount; i++) {
        if (ctrl.signal.aborted) return;
        const urls = collectSectionMedia(sections[i], jobId, language);
        preloadedSectionsRef.current.add(i);
        console.log(`[MediaPreloader] Phase 1 — section ${i} — ${urls.length} assets`);
        for (const url of urls) {
          if (ctrl.signal.aborted) return;
          await fetchAsBlob(url, ctrl.signal, i);
          loadedSoFar++;
          if (mountedRef.current) {
            setCacheProgress({ loaded: loadedSoFar, total: totalAssets });
          }
        }
      }
      if (mountedRef.current && !ctrl.signal.aborted) {
        console.log(`[MediaPreloader] Phase 1 COMPLETE — ${loadedSoFar}/${totalAssets} assets cached — blobMap size=${blobMapRef.current.size}`);
        setInitialReady(true);
      }
    };

    run();

    return () => {
      ctrl.abort();
    };
  }, [jobId, language, sections, fetchAsBlob]);

  // Phase 2: rolling prefetch when currentIndex changes
  useEffect(() => {
    if (!initialReady || sections.length === 0) return;

    const ctrl = new AbortController();

    const run = async () => {
      console.log(`[MediaPreloader] Phase 2 — rolling prefetch from section ${currentIndex + 1} to ${Math.min(currentIndex + LOOKAHEAD, sections.length - 1)}`);
      for (let i = currentIndex + 1; i <= currentIndex + LOOKAHEAD && i < sections.length; i++) {
        if (ctrl.signal.aborted) return;
        await preloadSection(i, ctrl.signal);
      }
      console.log(`[MediaPreloader] Phase 2 done — blobMap total=${blobMapRef.current.size}`);
    };

    run();
    return () => ctrl.abort();
  }, [currentIndex, initialReady, sections.length, preloadSection]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      console.log(`[MediaPreloader] UNMOUNT — revoking ${blobMapRef.current.size} blob URLs`);
      blobMapRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobMapRef.current.clear();
    };
  }, []);

  const getBlob = useCallback((proxySrc: string): string | null => {
    const blob = blobMapRef.current.get(proxySrc) || null;
    if (blob) {
      console.log(`[MediaPreloader] getBlob HIT — ${proxySrc.slice(-50)} → ${blob.slice(0, 30)}...`);
    } else {
      console.log(`[MediaPreloader] getBlob MISS — ${proxySrc.slice(-50)}`);
    }
    return blob;
  }, []);

  return { getBlob, initialReady, cacheProgress };
}
